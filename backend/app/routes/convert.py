"""
Conversion endpoints for point clouds and other large data formats that require server-side processing.


STRATUM - Proprietary and Confidential
Copyright (c) 2026 Andrei Banu, Mircea Levin-Constantin, Ferritworks S.R.L., and its licensees.
All rights reserved.
No license is granted. Unauthorized copying, modification, distribution, or use is prohibited.
Use is permitted only for the owners above and parties explicitly licensed in writing by Ferritworks S.R.L.
"""

import hashlib
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from app.dependencies import get_current_user
from app.minio_client import minio_client
from app.models import User

router = APIRouter(prefix="/convert", tags=["convert"])


def detect_ext(name_or_url: str) -> str:
    """Extract the lowercase file extension from a filename or URL.

    Strips query parameters and path components before extracting the
    extension.

    Args:
        name_or_url: A filename or URL string.

    Returns:
        The lowercase extension without a leading dot, or an empty string
        if none is found.
    """
    path = name_or_url.split("?")[0]
    if "/" in path:
        path = path.rsplit("/", 1)[-1]
    if "." in path and not path.startswith("."):
        return path.rsplit(".", 1)[-1].lower()
    return ""


def write_ply_ascii(positions, colors=None) -> bytes:
    """Write point cloud data as an ASCII PLY file.

    Args:
        positions: Flat list of floats ``[x0, y0, z0, x1, y1, z1, ...]``.
        colors: Optional flat list of floats ``[r0, g0, b0, ...]`` in the
            0.0–1.0 range. Values are scaled to 0–255 for output.

    Returns:
        The complete PLY file contents as bytes.
    """
    count = len(positions) // 3
    has_color = colors is not None and len(colors) == count * 3
    header = [
        "ply",
        "format ascii 1.0",
        f"element vertex {count}",
        "property float x",
        "property float y",
        "property float z",
    ]
    if has_color:
        header += [
            "property uchar red",
            "property uchar green",
            "property uchar blue",
        ]
    header += ["end_header\n"]
    lines = []
    if has_color:
        for i in range(count):
            x = positions[i * 3 + 0]
            y = positions[i * 3 + 1]
            z = positions[i * 3 + 2]
            r = max(0, min(255, int(colors[i * 3 + 0] * 255)))
            g = max(0, min(255, int(colors[i * 3 + 1] * 255)))
            b = max(0, min(255, int(colors[i * 3 + 2] * 255)))
            lines.append(f"{x} {y} {z} {r} {g} {b}")
    else:
        for i in range(count):
            x = positions[i * 3 + 0]
            y = positions[i * 3 + 1]
            z = positions[i * 3 + 2]
            lines.append(f"{x} {y} {z}")
    body = "\n".join(lines).encode("utf-8")
    return "\n".join(header).encode("utf-8") + body


def parse_las_python(
    buf: bytes, max_points: int = 2_000_000
) -> tuple[list, list | None]:
    """Parse a binary LAS (LiDAR) file into position and color arrays.

    Supports uncompressed point formats 0–3. If the file contains RGB
    data it is returned directly; otherwise colours are synthesised from
    point intensity using a blue-to-red colour ramp.

    Args:
        buf: Raw bytes of the LAS file.
        max_points: Maximum number of points to return (subsampled evenly
            when the file exceeds this count).

    Returns:
        A tuple ``(positions, colors)`` where *positions* is a flat list
        of floats ``[x, y, z, ...]`` and *colors* is either a flat list
        of normalised RGB floats or ``None``.

    Raises:
        ValueError: If the data is compressed, not a valid LAS file, or
            has an invalid record length.
    """
    # Minimal LAS parser similar to frontend; supports common formats 0-3 (no compression)
    import struct

    b = memoryview(buf)
    n = len(b)
    # quick checks
    if n >= 2 and b[0] == 0x1F and b[1] == 0x8B:
        raise ValueError("Compressed (gzip/LAZ) not supported")
    if n >= 1 and b[0] == 0x3C:  # '<' HTML/XML
        raise ValueError("Received HTML/XML, not a LAS file (check URL/auth)")
    # find 'LASF'
    base = -1
    for i in range(0, min(n - 4, 8 * 1024 * 1024)):
        if b[i : i + 4].tobytes() == b"LASF":
            base = i
            break
    if base < 0:
        peek = bytes(b[: min(n, 16)]).hex(" ")
        raise ValueError(
            f"Not a LAS file (signature not found). First bytes: {peek}"
        )

    def u8(off):
        return b[off]

    def u16(off):
        return struct.unpack_from("<H", b, off)[0]

    def i32(off):
        return struct.unpack_from("<i", b, off)[0]

    def u32(off):
        return struct.unpack_from("<I", b, off)[0]

    def f64(off):
        return struct.unpack_from("<d", b, off)[0]

    point_format = u8(base + 104)
    rec_len = u16(base + 105)
    count = u32(base + 107)
    if count == 0:
        # estimate
        offset_pts = u32(base + 96) + base
        if rec_len == 0:
            raise ValueError("Invalid LAS record length 0")
        count = max(0, (n - offset_pts) // rec_len)
    x_scale = f64(base + 131)
    y_scale = f64(base + 139)
    z_scale = f64(base + 147)
    x_off = f64(base + 155)
    y_off = f64(base + 163)
    z_off = f64(base + 171)
    offset_pts = u32(base + 96) + base

    step = max(1, count // max_points) if count > max_points else 1
    outN = (count + step - 1) // step
    positions = [0.0] * (outN * 3)
    have_rgb = point_format in (2, 3)
    colors = [0.0] * (outN * 3) if have_rgb else None
    minI, maxI = 1e20, -1e20
    intensities = [0.0] * outN
    j = 0
    for i in range(0, count, step):
        p = offset_pts + i * rec_len
        if p + rec_len > n:
            break
        X = i32(p + 0)
        Y = i32(p + 4)
        Z = i32(p + 8)
        I = u16(p + 12)
        intensities[j] = I
        if I < minI:
            minI = I
        if I > maxI:
            maxI = I
        positions[j * 3 + 0] = X * x_scale + x_off
        positions[j * 3 + 1] = Y * y_scale + y_off
        positions[j * 3 + 2] = Z * z_scale + z_off
        if have_rgb and colors is not None:
            rgb_off = p + (20 if point_format == 2 else 28)
            if rgb_off + 6 <= n:
                r = u16(rgb_off + 0)
                g = u16(rgb_off + 2)
                bch = u16(rgb_off + 4)
                colors[j * 3 + 0] = r / 65535.0
                colors[j * 3 + 1] = g / 65535.0
                colors[j * 3 + 2] = bch / 65535.0
        j += 1
        if j >= outN:
            break
    # intensity to color if no rgb
    if colors is None:
        span = max(1.0, (maxI - minI))
        colors = [0.0] * (j * 3)

        def colmap(t: float):
            t = max(0.0, min(1.0, t))
            if t < 0.25:
                k = t / 0.25
                return (0.0, k, 1.0)
            elif t < 0.5:
                k = (t - 0.25) / 0.25
                return (0.0, 1.0, 1.0 - k)
            elif t < 0.75:
                k = (t - 0.5) / 0.25
                return (k, 1.0, 0.0)
            else:
                k = (t - 0.75) / 0.25
                return (1.0, 1.0 - k, 0.0)

        for k in range(j):
            t = (intensities[k] - minI) / span
            r, g, bl = colmap(t)
            colors[k * 3 + 0] = r
            colors[k * 3 + 1] = g
            colors[k * 3 + 2] = bl
    # Truncate arrays if loop ended early
    positions = positions[: j * 3]
    colors = colors[: j * 3] if colors is not None else None
    return positions, colors


def parse_las_ascii(
    buf: bytes, max_points: int = 2_000_000
) -> tuple[list, list | None]:
    """Very tolerant parser for LAS (Log ASCII Standard) well log files.
    This is NOT LiDAR LAS. We attempt to extract X/Y/Z-like columns from the ~ASCII section
    according to curve names defined in the ~Curves section. If suitable columns are not found,
    we will synthesize a simple line using DEPTH as Z and zeros for X/Y so the viewer can still render something.
    Returns (positions, colors) with positions as list[float] length N*3.
    """
    try:
        text = buf.decode("utf-8", errors="ignore")
    except Exception:
        text = buf.decode("latin-1", errors="ignore")

    # Normalize newlines and lowercase for section detection
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

    # Locate sections
    def _find_section_prefixes(prefixes: list[str]) -> int:
        prefs = [p.lower() for p in prefixes]
        for i, ln in enumerate(lines):
            t = ln.strip().lower()
            for p in prefs:
                if t.startswith(p):
                    return i
        return -1

    # Common variants: "~Curve", "~Curves", "~Curve Information" etc.
    idx_curves = _find_section_prefixes(["~curv", "~curves"])
    # ASCII can be "~ASCII" or shorthand "~A"
    idx_ascii = _find_section_prefixes(["~ascii", "~a"])
    if idx_ascii < 0:
        raise ValueError("Text LAS (~ASCII) section not found")

    # Parse curves names order
    curve_names: list[str] = []
    if idx_curves >= 0:
        i = idx_curves + 1
        while i < len(lines):
            ln = lines[i].strip()
            if ln.startswith("~"):  # next section
                break
            if ln and not ln.startswith(
                "#"
            ):  # typical curve line: NAME .UNIT : description
                # take name up to first space or '.'
                name = ln.split(":", 1)[0].strip()
                name = name.split(".", 1)[0].strip()
                name = name.split(" ", 1)[0].strip()
                if name:
                    curve_names.append(name)
            i += 1

    # Helper to map columns
    def find_idx(candidates: list[str]) -> int:
        cand_lower = [c.lower() for c in candidates]
        for j, nm in enumerate(curve_names):
            nml = nm.lower()
            if nml in cand_lower:
                return j
        return -1

    # Read ASCII data rows
    data_rows: list[list[float]] = []
    i = idx_ascii + 1
    # Determine how many columns to expect: curves length if >0, else infer from first numeric line
    expected_cols: int = len(curve_names) if curve_names else 0
    while i < len(lines):
        ln = lines[i].strip()
        if ln.startswith("~"):
            break
        if not ln or ln.startswith("#"):
            i += 1
            continue
        parts = [p for p in ln.replace("\t", " ").split() if p]
        # Infer expected columns once if not from curves
        if expected_cols == 0:
            expected_cols = len(parts)
        # Pad/trim to expected
        if len(parts) < expected_cols:
            # skip malformed row
            i += 1
            continue
        try:
            row = [float(x) for x in parts[:expected_cols]]
            data_rows.append(row)
        except ValueError:
            # skip non-numeric line
            pass
        i += 1

    if not data_rows:
        raise ValueError("Text LAS (~ASCII) section has no numeric rows")

    # Identify x,y,z columns with broader heuristics
    def norm(s: str) -> str:
        return "".join(ch for ch in s.upper() if ch.isalnum())

    def find_idx_heur(cands: list[str]) -> int:
        if not curve_names:
            return -1
        target = [norm(c) for c in cands]
        # exact normalized match first
        for j, nm in enumerate(curve_names):
            nml = norm(nm)
            if nml in target:
                return j
        # then contains
        for j, nm in enumerate(curve_names):
            nml = norm(nm)
            for t in target:
                if t in nml or nml in t:
                    return j
        return -1

    x_idx = find_idx_heur(
        [
            "X",
            "XCOORD",
            "X_COORD",
            "X-COORD",
            "EASTING",
            "EAST",
            "UTME",
            "EASTINGUTM",
            "E",
            "XE",
        ]
    )
    y_idx = find_idx_heur(
        [
            "Y",
            "YCOORD",
            "Y_COORD",
            "Y-COORD",
            "NORTHING",
            "NORTH",
            "UTMN",
            "NORTHINGUTM",
            "N",
            "YN",
        ]
    )
    z_idx = find_idx_heur(
        ["Z", "ELEV", "ELEVATION", "HEIGHT", "TVD", "TVDSS", "MD", "DEPT", "DEPTH"]
    )

    # Latitude/Longitude fallback to XY (meters) if needed
    lat_idx = find_idx_heur(["LAT", "LATITUDE", "LATD"])
    lon_idx = find_idx_heur(["LON", "LONG", "LONGITUDE", "LOND"])

    # If both X and Y missing but have lat/lon, create XY in meters using equirectangular approximation
    use_latlon = (x_idx < 0 or y_idx < 0) and (lat_idx >= 0 and lon_idx >= 0)

    # If still missing XY and have many curves, pick two with highest variance (excluding chosen Z if any)
    pick_var_indices: tuple[int, int] | None = None
    if (x_idx < 0 or y_idx < 0) and not use_latlon and curve_names:
        cols = len(curve_names)
        # sample up to 1000 rows evenly
        sample_n = min(1000, len(data_rows))
        sample_step = max(1, len(data_rows) // max(sample_n, 1))
        means = [0.0] * cols
        counts = [0] * cols
        for k in range(0, len(data_rows), sample_step):
            row = data_rows[k]
            for c in range(min(cols, len(row))):
                v = row[c]
                means[c] += v
                counts[c] += 1
        for c in range(cols):
            if counts[c] > 0:
                means[c] /= counts[c]
        vars_ = [0.0] * cols
        for k in range(0, len(data_rows), sample_step):
            row = data_rows[k]
            for c in range(min(cols, len(row))):
                dv = row[c] - means[c]
                vars_[c] += dv * dv
        # Exclude chosen z_idx from XY candidates if set
        cand = list(range(cols))
        if z_idx >= 0 and z_idx < cols:
            try:
                cand.remove(z_idx)
            except ValueError:
                pass
        # pick two highest variance columns
        cand.sort(key=lambda c: vars_[c], reverse=True)
        if len(cand) >= 2:
            pick_var_indices = (cand[0], cand[1])

    positions: list[float] = []
    count = 0
    step = max(1, len(data_rows) // max_points) if len(data_rows) > max_points else 1
    # If using lat/lon, compute reference lat/lon for meters conversion (mean of samples)
    lat0 = 0.0
    lon0 = 0.0
    if use_latlon:
        sample_n = min(1000, len(data_rows))
        sample_step = max(1, len(data_rows) // max(sample_n, 1))
        acc_lat = 0.0
        acc_lon = 0.0
        cnt = 0
        for k in range(0, len(data_rows), sample_step):
            row = data_rows[k]
            if lat_idx < len(row) and lon_idx < len(row):
                acc_lat += row[lat_idx]
                acc_lon += row[lon_idx]
                cnt += 1
        if cnt > 0:
            lat0 = acc_lat / cnt
            lon0 = acc_lon / cnt

    for k in range(0, len(data_rows), step):
        row = data_rows[k]
        # Synthesize missing axes as 0
        if 0 <= z_idx < len(row):
            z = row[z_idx]
        else:
            # prefer DEPTH if present for z
            dep_idx = find_idx_heur(["DEPT", "DEPTH"])
            z = row[dep_idx] if 0 <= dep_idx < len(row) else float(k)

        if 0 <= x_idx < len(row) and 0 <= y_idx < len(row):
            x = row[x_idx]
            y = row[y_idx]
        elif use_latlon and 0 <= lat_idx < len(row) and 0 <= lon_idx < len(row):
            lat = row[lat_idx]
            lon = row[lon_idx]
            import math

            lat_rad = math.radians(lat0)
            meters_per_deg_lat = 111132.0
            meters_per_deg_lon = 111320.0 * math.cos(lat_rad)
            x = (lon - lon0) * meters_per_deg_lon
            y = (lat - lat0) * meters_per_deg_lat
        elif pick_var_indices is not None:
            i1, i2 = pick_var_indices
            # guard lengths
            v1 = row[i1] if i1 < len(row) else 0.0
            v2 = row[i2] if i2 < len(row) else 0.0
            x, y = v1, v2
        else:
            x = 0.0
            y = 0.0
        positions.extend([x, y, z])
        count += 1

    if count == 0:
        raise ValueError("Text LAS parsed but no valid rows could be used")

    return positions, None


def parse_laz_laspy(
    buf: bytes, max_points: int = 2_000_000
) -> tuple[list, list | None]:
    """Parse LAZ (compressed LAS) using laspy + lazrs, return positions and optional RGB colors.
    Falls back to elevation-only coloring on the frontend if RGB is absent.
    """
    try:
        import laspy
    except Exception as e:
        raise ValueError(f"LAZ support not available: {e}")

    try:
        las = laspy.read(BytesIO(buf))
    except Exception as e:
        raise ValueError(f"Failed to read LAZ: {e}")

    n = len(las.points)
    if n == 0:
        return [], None

    step = max(1, n // max_points) if n > max_points else 1
    # Vectorized subsample
    x = las.x[::step]
    y = las.y[::step]
    z = las.z[::step]
    positions = []
    positions_extend = positions.extend
    for xi, yi, zi in zip(x, y, z):
        positions_extend([float(xi), float(yi), float(zi)])

    colors: list | None = None
    dims = set(las.point_format.dimension_names)
    if {"red", "green", "blue"}.issubset(dims):
        r = las.red[::step]
        g = las.green[::step]
        b = las.blue[::step]
        colors = []
        for ri, gi, bi in zip(r, g, b):
            colors.extend(
                [float(ri) / 65535.0, float(gi) / 65535.0, float(bi) / 65535.0]
            )

    return positions, colors


@router.get("/pointcloud")
async def convert_pointcloud(
    src: str = Query(..., description="Source URL to point cloud"),
    name: str | None = None,
    _current_user: User = Depends(get_current_user),
):
    """Remote URL conversion is disabled for security reasons.

    The ``GET /api/convert/pointcloud`` endpoint is intentionally kept to
    provide a clear migration signal to clients. Upload-based conversion via
    ``POST /api/convert/pointcloud`` remains supported.
    """
    _ = (src, name)
    raise HTTPException(
        status_code=403,
        detail="Remote URL conversion is disabled for security. Upload the file to POST /api/convert/pointcloud.",
    )


@router.post("/pointcloud")
async def convert_pointcloud_upload(
    file: UploadFile = File(..., description="Point cloud file to convert"),
    name: str | None = Form(None),
    _current_user: User = Depends(get_current_user),
):
    """Accepts a file upload (multipart/form-data) and converts to a PLY stored in MinIO.
    Currently supports: LAS (uncompressed). PLY/PCD are re-uploaded as-is.
    """
    # Determine extension preference: explicit form name > upload filename
    provided_name = name or file.filename or "upload"
    ext = detect_ext(provided_name)
    extU = ext.upper()

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")

    # Fast-path for PLY/PCD: store and return presigned URL
    if ext in ("ply", "pcd"):
        key_base = hashlib.sha1(
            (provided_name + str(len(data))).encode("utf-8")
        ).hexdigest()
        object_name = f"uploads/{key_base}.{ext}"
        await minio_client.upload_file(data, object_name, "application/octet-stream")
        url = minio_client.get_presigned_url(object_name, expiry=3600)
        return JSONResponse({"ok": True, "format": extU, "url": url})

    if ext == "las":
        try:
            positions, colors = parse_las_python(data, max_points=2_000_000)
        except ValueError as e:
            # Fallback to ASCII LAS tolerant parser
            try:
                positions, colors = parse_las_ascii(data, max_points=2_000_000)
            except Exception:
                raise HTTPException(status_code=400, detail=f"LAS parse failed: {e}")
        ply_bytes = write_ply_ascii(positions, colors)
        key_base = hashlib.sha1(
            (provided_name + str(len(ply_bytes))).encode("utf-8")
        ).hexdigest()
        object_name = f"converted/{key_base}.ply"
        await minio_client.upload_file(
            ply_bytes, object_name, "application/octet-stream"
        )
        url = minio_client.get_presigned_url(object_name, expiry=3600)
        return JSONResponse({"ok": True, "format": "PLY", "url": url})

    if ext == "laz":
        try:
            positions, colors = parse_laz_laspy(data, max_points=2_000_000)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"LAZ parse failed: {e}")
        if not positions:
            raise HTTPException(
                status_code=400, detail="LAZ parse produced no points"
            )
        ply_bytes = write_ply_ascii(positions, colors)
        key_base = hashlib.sha1(
            (provided_name + str(len(ply_bytes))).encode("utf-8")
        ).hexdigest()
        object_name = f"converted/{key_base}.ply"
        await minio_client.upload_file(
            ply_bytes, object_name, "application/octet-stream"
        )
        url = minio_client.get_presigned_url(object_name, expiry=3600)
        return JSONResponse({"ok": True, "format": "PLY", "url": url})

    if ext in ("e57", "rwi", "rwp"):
        raise HTTPException(
            status_code=501,
            detail=f"Server-side conversion for {extU} not configured. Install PDAL/CloudCompare and wire converters.",
        )

    raise HTTPException(
        status_code=400, detail=f"Unsupported point cloud format: {extU}"
    )
