var path = require('path');
var fs = require('fs');
const { consolelog,verboseThresholdGlobal,JC } = require('./app.js');

var dataFiles= new Array()
var directoryPath = path.join(__dirname, '..', 'data');
consolelog(`file.js said  l7 : directoryPath= ${directoryPath}`,10)
/********************************************************************************************/

/**
 * remplit  la variable 'dataFiles' avec les noms de fichiers contenus dans le dossier 'data'
 * @returns 
 */
function listDataFiles()
{
    //rempli dataFiles avec les noms de fichiers de data
    consolelog("entering listDataFiles files.js l 17",10)
    consolelog(`files.js l 18 ${directoryPath}`,10)
    return new Promise( function(resolve, reject){
    try {
        //joining path of directory 
        //passsing directoryPath and callback function
        fs.readdir(directoryPath, function (err, files) {
            //handling error
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            } 
            dataFiles=[]
            //listing all files using forEach
            files.forEach(function (file) {
                if (path.extname(file) == ".dat"){
                    dataFiles.push(file)
                 //   console.log(file); 
                }
            } );
            resolve(dataFiles)
        });
    }
    catch (error) {
        reject(error)
    }
  });
}  // FIN function listDataFiles()
/********************************************************************************************/


/**
 * supprime les fichiers dans le dosier 'data'
 * @param {*} files 
 * @returns 
 */
function deleteFileList(files){
 // supprime les fichiers dans la liste
 var deleted=0
    files.forEach(f => {
        var fname = directoryPath + '/' + f
        fs.unlink( fname, function(err){
        if(err) 
            return console.log(err);
        deleted ++
        console.log(fname,' deleted successfully', deleted);
         });  
     });
   return deleted
} // FIN function deleteFileList(files){
/********************************************************************************************/

/**
 * export de variables et fonction
 */
module.exports = {
    files : dataFiles,
    list : listDataFiles,
    delete : deleteFileList
}
