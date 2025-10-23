import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { consolelog } from './globals.js';

let dataFiles = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const directoryPath = path.join(__dirname, '..', 'data');
consolelog(`file.js said  l7 : directoryPath= ${directoryPath}`, 10);

/********************************************************************************************/

/**
 * remplit  la variable 'dataFiles' avec les noms de fichiers contenus dans le dossier 'data'
 * @returns
 */
function listDataFiles() {
    //rempli dataFiles avec les noms de fichiers de data
    consolelog('entering listDataFiles files.js l 17', 10);
    consolelog(`files.js l 18 ${directoryPath}`, 10);
    return new Promise((resolve, reject) => {
        try {
            // joining path of directory
            // passsing directoryPath and callback function
            fs.readdir(directoryPath, (err, files) => {
                // handling error
                if (err) {
                    return console.log(`Unable to scan directory: ${err}`);
                }
                dataFiles = [];
                // listing all files using forEach
                files.forEach((file) => {
                    if (path.extname(file) === '.dat') {
                        dataFiles.push(file);
                        //   console.log(file);
                    }
                });
                resolve(dataFiles);
            });
        } catch (error) {
            reject(error);
        }
    });
} // FIN function listDataFiles()

/********************************************************************************************/

/**
 * supprime les fichiers dans le dosier 'data'
 * @param {*} files
 * @returns
 */
function deleteFileList(files) {
    // supprime les fichiers dans la liste
    let deleted = 0;
    files.forEach((f) => {
        const fname = `${directoryPath}/${f}`;
        fs.unlink(fname, (err) => {
            if (err) {
                return console.log(err);
            }
            deleted += 1;
            consolelog(`${fname} deleted successfully`, 10);
            return undefined;
        });
    });
    return deleted;
} // FIN function deleteFileList(files){

/********************************************************************************************/

const fileStore = {
    get files() {
        return dataFiles;
    },
    list: listDataFiles,
    delete: deleteFileList,
};

export { dataFiles as files, listDataFiles as list, deleteFileList as delete };
export default fileStore;
