#!/usr/bin/env python3
# Wrapper pour enrichissement batch quiz
import sys
import os
os.system('python ../quiz/enrich_batch_auto.py ' + ' '.join(sys.argv[1:]))
# Voir README pour usage détaillé
