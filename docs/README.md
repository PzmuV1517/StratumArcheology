# Documentation Build Instructions

## Building the Documentation

The STRATUM documentation is written in reStructuredText (RST) and built with Sphinx.

### Prerequisites

```bash
cd docs
pip install -r requirements.txt
```

### Build HTML Documentation

```bash
cd docs
make html
```

The built documentation will be in `_build/html/`. Open `_build/html/index.html` in your browser.

### Build PDF Documentation

```bash
make latexpdf
```

### Clean Build Files

```bash
make clean
```

## Publishing

The documentation can be hosted on:

- GitHub Pages
- Read the Docs
- Custom web server

See `publish-wiki.sh` for automated deployment scripts.
