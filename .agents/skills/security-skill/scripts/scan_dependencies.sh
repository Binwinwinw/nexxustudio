#!/bin/bash
# scan_dependencies.sh — Check vulnérabilités connues
composer audit || true
npm audit || true
