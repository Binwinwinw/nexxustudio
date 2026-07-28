#!/usr/bin/env python3
# Wrapper pour la génération de banque quiz
import sys
import os
os.system('python ../quiz/generate_quiz_bank.py ' + ' '.join(sys.argv[1:]))
# Voir README pour usage détaillé
