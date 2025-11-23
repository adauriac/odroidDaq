1. La conversion des data dans initParser() (daq3.js) revue
2. Le calcul de la transformée de welch se fait en js en utilisant fftw-js  (port de fftw en js) en la fonction welch elle-meme est la traduction en js de celle en python de scipy
3. L'échange de données se fait maintenant avec cbor-x plutôt que json
4. L'affichage ne melange pas "tick" en "line" qui pénalise considérablement 

Le projet a été standardisé  avec **openAIcodex**

Lorsque le server est lancé il clignote toutes les 500ms.
