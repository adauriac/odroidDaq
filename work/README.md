1. welchSimuleParFFT.py montre comment calculer une Welch transform aevc une fft pour le jeu de paramètres de app.js sur des données aléatoires.
2. cmpPyJs sert à comparer une implémentation javascript et python.
   cmpPyJS.js et cmpPyJs.py calculent la fft ou Welch du fichier exampleSignal, un flag f/w sur la ligne de cmd choisi quelle tranformation
   cmpPyJs.sh lance les deux et affiche un résumé
   Fft est mais pour Welch les deux premières valeurs (0, plus petite frequence) sont DIFFERENTES (?)
   
cmpPyJS.js contient la fonction javascript welchise
__________________________________________________________________________________

Pour ne pas envoyer trop de data au client on utilise une fonction qui crunche :
on donne un entier N de l'ordre du nombre de points d'abscisse différent dessinable.
Par exemple 1024 si 1024 points sur l'écran. Ensuite l'intervale [log(fmin),log(fmax)]
est divisé en N bins. Si un bin est vide on le saute, s'il a 1 point on garde ce point, s'il
a plus d'un point on le remplace les points de ce bin par deux points. Ces deux points
ont la même abscisse qui est la moyenne des abscises du bin (tous correspondent au
même point de l'écran) et ont comme ordonnée respectivement le min et le max des
ordonnées). L'application "affichageAccelere.js" lit le fichier data.txt et sort à l'écran 
lze resultat du crunching de ce fichier. Par exemple :
node affichageAccelere.js > fichierCrunche
puis dans gnuplot plot "data.txt" usi 1:2 wi li, "fichierCrunche" us 1:2 wi li
