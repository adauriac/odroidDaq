dans ce répertoire on cherche à comprendre le "déchrochage"
Pour ça on commence à comparer les resultats obtenu a travers le
server et ceux ontenu par un mini python pg

1. en python directement sans asynchrone : pas de pb
   avec ../cliTesteur.py on produit: resultFromCli.txt et le dessin resultFromCli.pdf
   
2. en rajoutant temporairement sur daq3.js line 66 la sortie brute des données dans trace 
   et en utilisant analyseTrace.py. 
   Lancer le server modifié et acquisition de 16 K. (sortie de plus daq3.js line 66 commentées) 
   Copier le fichier ../../../trace dans ce repertoire 
   Lancer analyseTrace.py, puis dessiner le fichier, ou en un seul coup dans gnuplot:
   plot "< analyseTrace.py traceSpecifiqueDonnesBrutes1" usi :1 w li
   on produit: resultFromCli.txt et le dessin resultFromServer.pdf
   
3. threshold= 131071= 2**17-1 et maxint= 262142=2**18
