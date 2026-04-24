# STRATUM Documentation Guide

This folder contains product, API, and engineering documentation for STRATUM.

## Build Documentation

The docs are written primarily in reStructuredText and built with Sphinx.

### Prerequisites

```bash
cd docs
pip install -r requirements.txt
```

### Build HTML

```bash
cd docs
make html
```

Output is generated under `_build/html/`.

### Build PDF

```bash
cd docs
make latexpdf
```

### Clean

```bash
cd docs
make clean
```

## Documentation Map

- `index.rst`: main table of contents
- `development.rst`: engineering standards and contribution workflow
- `frontend-styleguide.rst`: frontend visual and interaction standards
- `api/*.rst`: API reference
- `features.rst`, `forms.rst`, `files-management.rst`: product guides

## Style And Design Documentation

If you are making frontend changes, review these first:

1. `development.rst`
2. `frontend-styleguide.rst`

Keep docs in sync with implementation changes in the same pull request.
