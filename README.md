# odroidDaq
for Neel institute

the welch transform was performed by a python script this was excessively slow
Since no welch transform is available in js, we will write a welch in js using a fft in js.
1. write a program in python performing a welch transform only using ONLY a fft transform.
   This is done in work/welchSimuleParFFT.py, we see perfect matching 
2. write a ftt in js completely compatible with the python (scipy.fft)
   This is done in work/TODO
3. Write the welch in js.

In python one use scipy, and in js github.com/indutny/fft.js/blob/master/README.md.
Note that this fft in js NEEDS a signal of size power of two.
See welch.lyx to understand how it works.
For some reason scipy.fft is not properly install on odroid, so I perform the check in the odroid directory mounted on a ubuntu machine

Réunion avec Julien le mer. 28 mai 2025 17:53:12 CEST:
1. ordonnée de fft incorrect, erreur liée à "external gain"
2. le signal brut présente un "saut" bizarre. Dans la version initiale ce saut n'est présent que si le nombre de points est 16K.  
3. upload.html ne fonctionne pas : probablement du à la localisation des fichiers
4. pourquoi segment l=2 ou 3 ralentis tant le calcul
5. penser au déploiement.

Reunion jeu. 25 sept.
* problème d'anomalie de signal au petit temps pas important
* faire sortir du python de Pierre l'entree et la sortie de welch (fft3.py)
* faire sortir de welchise 1'entree et la sortie de welch
* differents naviguateurs
* plusieurs segments
* penser a supprimer le tableau dataWork de welchise1 si inutile
* faire un script node qui se compare a welchSimuleParFft.py
