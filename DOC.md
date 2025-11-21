1. La conversion des data dans initParser() (daq3.js) revue
2. Le calcul de la transformée de welch se fait en js en utilisant fftw-js  (port de fftw en js) la fonction welch elle-meme est la traduction en js de celle en python de scipy
3. L'échange de données se fait maintenant avec cbor-x plutôt que json
4. L'affichage ne melange pas "tick" en "line" qui pénalise considérablement 
5. Répertoires de lecture et d'écriture de tous les fichiers en adressage relatifs 

Par rapport à la version initiale deux répertoires ont été rajoutés : ~/bin (rigidité mentale de JC) et odroidDaq (nouvelle version) qui est sous surveillance git.

Le nouveau service entierement systemd (systemctl) a été refait et s'appelle serveurOdroid

Le projet a été standardisé  avec **openAIcodex**

Lorsque le server est lancé il clignote toutes les 500ms.
