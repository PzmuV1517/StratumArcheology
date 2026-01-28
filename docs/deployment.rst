============================
Deployment Guide
============================

Deploy STRATUM to production environments.

.. contents:: Table of Contents
   :local:
   :depth: 2

Production Setup
================

Requirements
------------

- Linux server (Ubuntu 22.04+ recommended)
- Docker & Docker Compose
- NGINX for reverse proxy
- SSL certificate (Let's Encrypt)
- Domain name

Quick Deploy
------------

.. code-block:: bash

   # Clone repository
   git clone https://github.com/your-org/stratum.git
   cd stratum/backend
   
   # Configure environment
   cp .env.example .env.production
   # Edit .env.production with production values
   
   # Start services
   docker-compose -f docker-compose.prod.yml up -d

.. seealso::
   Complete deployment documentation available in GitHub wiki
