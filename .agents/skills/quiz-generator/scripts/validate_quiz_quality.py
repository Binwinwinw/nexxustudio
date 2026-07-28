#!/usr/bin/env python3
# Wrapper pour validation qualité quiz
import sys
import os
os.system('python ../quiz/validate_quiz_quality.py ' + ' '.join(sys.argv[1:]))
# Voir README pour usage détaillé
