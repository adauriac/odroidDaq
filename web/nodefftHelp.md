

# nodeFFT 
![nodeFFT logo](medias/logoNEELQ.jpg)

un analyseur de spectre (FFT) à base de :
* Odroid XU4 : Ubuntu 20.04 (Linux version 5.4.149-232 )
* [ANALOGMAX-DAQ3](https://www.arrow.com/en/products/analogmax-daq3/trenz-electronic-gmbh) Trenz Electronic GmbH :  High-accuracy, 18-bit, 2 MSPS μModule® (Analog Devices ADAQ4003)
* carte ampli/filtre made in Neel

## Démarrage

aprés avoir alimenté le boitier nodeFFT avec son boitier d'alim, la led *POWER* (rouge) s'allume, et peu de temps après la led *RUN* (verte) clignotte. le boitier est pret !

## Accès

Après avoir relié le boitier **NodeFFT** au reseau, i faut trouver l'adreese que lui a attribué le routeur..
Pour cela on peut :
* soit aller sur la page d'accueil du routeur (par ex: 192.168.1.1 ) pour visualiser les *appareils connectés*
* soit taper dans une console :
    > nmap -sn 192.168.1.0/24   

On peut alors se connecterau boitier **NodeFFT** sur le **port 3000** depuis un navigatuer web...
> http://192.168.1.28:3000

## Principe

Le processeur Odroid se charge de la communication entre l'utilisatur et la carte **DAQ3** branchée sur un de ses ports USB.  
Cette carte digitalise le signal differentiel present entre les 2 connecteurs BNC du boitier, au travers de la carte Ampli/Filtre.

Un ensemble de scripts *nodejs* permet :
* la configuration de la carte Ampli/filtre et la carte DAQ3
* l'acquisition d'un signal analogique
* le calcul de la  FFT de ce signal
* l'affichage (*plot*) de ces signaux
* la sauvegarde des signaux analogique et FFT sur l'odroid
* la gestion et la recupération de ces fichiers textes.

## Acquisition
La premiere chose à faire est de sélectionner le port USB de l'Odroid sur lequel est connecté la carte DAQ3 (repéré par *ARROW*) par la liste déroulante ComPort :
* La configuration courante de la carte *DAQ3* et de la carte *Ampli/Filtre* est presentée sur cette page web.
* Le temps systeme (identique à celui du PC utilisé pour se conncter au boitier) est affiché en haut à gauche
* ainsi que la temperature CPU (toutes les minutes) en *vert* si tout va bien, en *orange* ou *rouge* sinon..

### configuration


## FFT

## Fichiers

## Arret