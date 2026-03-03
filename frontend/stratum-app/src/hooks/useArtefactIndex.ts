/**
 * useArtefactIndex
 *
 * Lightweight hook that loads the flat list of artefacts for a project
 * so other components (Wheeler, Harris Matrix) can reference them by id
 * without needing access to the full ArtefactsTab component.
 *
 * Each ArtefactIndexItem holds the FileNode folder id (used as the stable
 * artefact identifier everywhere in the system), plus the human-readable
 * name and catalogue number from `artefact.json`.
 *
 * MIT License
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { fileService } from "../services/fileService";

/**
 * Platform-safe helper that reads text from a fileService downloadFile result.
 * On web, `result.blob` is a Blob; on native, `result.uri` is a local file path.
 */
async function readDownloadText(res: {
  blob?: Blob;
  uri?: string;
}): Promise<string | null> {
  if (res.blob) return res.blob.text();
  if (res.uri && Platform.OS !== "web") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FS = require("expo-file-system");
      return (await FS.readAsStringAsync(res.uri, {
        encoding: "utf8",
      })) as string;
    } catch {
      return null;
    }
  }
  return null;
}

export interface ArtefactIndexItem {
  /** FileNode folder id — the stable identifier used for linking */
  id: string;
  name: string;
  number: number;
}

export function useArtefactIndex(projectId: string): ArtefactIndexItem[] {
  const [items, setItems] = useState<ArtefactIndexItem[]>([]);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const root = await fileService.listRoot(projectId);
      const af = root.find(
        (n: any) => n.type === "folder" && n.name === "Artefacts",
      );
      if (!af) return;

      const children = await fileService.listChildren(af.id);
      const folders = children.filter((c: any) => c.type === "folder");

      const out: ArtefactIndexItem[] = [];
      for (const f of folders) {
        try {
          const grand = await fileService.listChildren(f.id);
          const metaFile = grand.find(
            (c: any) =>
              c.type === "file" &&
              (c.name === "artefact.json" || c.name.endsWith(".json")),
          );
          if (metaFile) {
            const res = await fileService.downloadFile(metaFile.id);
            const text = await readDownloadText(res);
            if (text) {
              const meta = JSON.parse(text);
              out.push({
                id: f.id,
                name: meta.name ?? f.name,
                number: typeof meta.number === "number" ? meta.number : 0,
              });
              continue;
            }
          }
        } catch {
          // ignore per-artefact errors
        }
        // fallback: use folder name
        out.push({ id: f.id, name: f.name, number: 0 });
      }

      // sort descending by number, then alphabetically for ties
      out.sort((a, b) => b.number - a.number || a.name.localeCompare(b.name));
      setItems(out);
    } catch {
      // silently fail — artefact linking is non-critical
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return items;
}
