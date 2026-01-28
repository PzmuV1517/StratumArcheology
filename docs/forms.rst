============================
Archaeological Forms
============================

Standardized data collection forms for archaeological documentation.

.. seealso::
   **Need help understanding technical terms?** Visit `legend.rst <legend.rst>`_ for explanations of all terminology and concepts used here.

.. contents:: Table of Contents
   :local:
   :depth: 2

Overview
========

STRATUM provides three main form types:

1. **Context Features** - Pits, ditches, layers
2. **Stratigraphic Units** - Soil deposits
3. **Artifacts** - Find registration with QR codes

All forms auto-save to locked CSV files in the Files tab.

Context Features
================

Document archaeological features:

- Context number
- Feature type
- Dimensions
- Description
- Associated finds

**CSV Export Location:** ``/Forms/ContextFeatures.csv``

Stratigraphic Units
===================

Record soil deposits:

- Unit number
- Soil description
- Color (Munsell)
- Relationships
- Dating

**CSV Export Location:** ``/Forms/StratigraphicUnits.csv``

Artifacts
=========

Register finds with QR codes:

- Artifact number
- Material type
- Context
- Photos
- QR code

**CSV Export Location:** ``/Forms/Artefacts.csv``

.. seealso::
   `api/forms.rst <api/forms.rst>`_ for Forms API
