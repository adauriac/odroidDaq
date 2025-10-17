app.js recoit l'ordre de calculer la xformée de Welch/ en utilisant fft3.py
1- il prépare les paramètres : 
	f=TEIs.getModule(TEImodule).AdcSamplingRate (tjrs 2000000)
	s=acq\_samples qui est variable globale affectee par samples et Ok (valeur du formulaire (16, 32, 64, 128, 256 ou 1024)
	m=seg qui est le nombre de segments, affecté à l'entrée de la fonction (valeur du formulaire)
2- il lance fft3.py avec les 3 paramètres f s et m sur la CLI qui s'appeleront alors dans python   fs, samples et seg
	et écrit sur le stdin du python  les données en format json {"0":x0,"1":x1, ...,"16383":xlast}
3- fft3.py récupère les data sur stdin et les dejsonifie vers une liste de float 
   a/ appelle welch: 
         nbperseg = samples*1024
		 f1,Pxx1\_den = welch(data, fs, 'hann',nperseg=nbperseg, scaling='density') 
	b/ si seg>1:
	    nbperseg = samples * 1024/seg
	    on recommence avec f2, P2xx\_den = signal.welch(data, fs, 'hann',nperseg=nbperseg, scaling='density')
	c/ calcul Pout=np.sqrt(Pxx1\_den) Pout2=np.sqrt(Pxx2\_den)
	retourne en json f1,Pout1,f2,Pout2 
------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Dernière abscisse de la fft vaut 1000000 quelque soit Sample kS et quelque soit la segmentation, mais le nombre de 
lignes est divisé par segmentation nbLignes, donc la premiere frequence non nulle est multipliée par segmentation


