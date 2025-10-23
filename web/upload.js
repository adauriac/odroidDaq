const version = '20230123';

const CBOR_MIME = "application/cbor";
let cborEncode = null;
let cborDecode = null;
let cborReadyPromise = null;

function hasValidCbor(api) {
    return api && typeof api.encode === "function" && typeof api.decode === "function";
}

function normalizePath(path) {
    if (!path) return "/";
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("/")) return path;
    return `/${path}`;
}

function isTypedArray(value) {
    return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function resolveCborApi(candidate) {
    if (!candidate) {
        return null;
    }
    if (hasValidCbor(candidate)) {
        return candidate;
    }
    if (candidate.default && hasValidCbor(candidate.default)) {
        return candidate.default;
    }
    if (candidate.CBOR && hasValidCbor(candidate.CBOR)) {
        return candidate.CBOR;
    }
    if (candidate.cbor && hasValidCbor(candidate.cbor)) {
        return candidate.cbor;
    }
    if (candidate.cborx && hasValidCbor(candidate.cborx)) {
        return candidate.cborx;
    }
    return null;
}

async function ensureCborReady() {
    if (cborEncode && cborDecode) {
        return;
    }
    if (!cborReadyPromise) {
        cborReadyPromise = (async () => {
            let api = null;
            if (typeof globalThis !== "undefined") {
                api = resolveCborApi(globalThis.CBOR || globalThis.cbor || globalThis.cborx);
            }
            if (!api && typeof window !== "undefined") {
                api = resolveCborApi(window.CBOR || window.cbor || window.cborx);
            }
            if (!api && typeof self !== "undefined") {
                api = resolveCborApi(self.CBOR || self.cbor || self.cborx);
            }
            if (!api) {
                throw new Error("cbor-x encode/decode API is not available");
            }
            cborEncode = (value) => api.encode(value);
            cborDecode = (bytes) => api.decode(bytes);
        })().catch((error) => {
            cborReadyPromise = null;
            throw error;
        });
    }
    return cborReadyPromise;
}

async function cborRequest(path, options = {}) {
    await ensureCborReady();
    const method = options.method || "GET";
    const url = normalizePath(path);
    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) {
        headers.set("Accept", CBOR_MIME);
    }

    let body = options.body;
    if (body !== undefined && body !== null && !isTypedArray(body) && !(body instanceof ArrayBuffer) && !(body instanceof Blob) && !(body instanceof FormData)) {
        body = cborEncode(body);
        headers.set("Content-Type", CBOR_MIME);
    }

    const init = { method, headers, credentials: options.credentials, cache: options.cache, keepalive: options.keepalive, signal: options.signal };
    if (body !== undefined) {
        init.body = body;
    }

    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`${method} ${url} -> ${response.status}`);
    }

    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith(CBOR_MIME)) {
        if (!contentType) {
            return null;
        }
        throw new Error(`${method} ${url} unexpected content-type ${contentType}`);
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) {
        return null;
    }
    return cborDecode(new Uint8Array(buffer));
}

function logRequestError(context, error) {
    console.error(`${context} failed`, error);
}

var filesToGet=[], filesToDel=[], allFiles=[]
var nbFilesToGet=0, nbFilesToDel=0;

function setupPage(){
    fetchFileList();
} // FIN function setupPage()
// *******************************************************************************************************

function fetchFileList() {
    cborRequest('/listDir')
        .then((response) => {
            if (response && Array.isArray(response.files)) {
                populate(response.files);
                const zipButton = document.getElementById('zipButton');
                if (zipButton) {
                    zipButton.disabled = response.files.length === 0;
                }
            }
        })
        .catch((error) => logRequestError('GET /listDir', error));
}
// ******************************************************************************************************

function unencrypt(){
    // should return Uint8Array
    return new Uint8Array()
}  // FIN function unencrypt(){
// ******************************************************************************************************

function populate( fileList ){
    // // et remplit la fenetre
    var tbody = document.getElementById('files');
    var trf = document.getElementById('f_0');
    var i=0
    filesToGet = [];
    filesToDel = [];
    allFiles = [];
    (fileList || []).forEach(element => {
        console.log(`upload.js l89 populate element=${element}`);
        // remplace les _0 par _i
        var text = trf.innerHTML.replace(/([_])0/g,  "_"+i)
        text = text.replace(/(filename)/g, element)
        mytr = document.createElement("tr");
        mytr.innerHTML = text
        tbody.appendChild(mytr)
        // liste des fichiers dispos
        allFiles.push(element)
        i++
    });
    //vire le premier element (origine)    
    tbody.removeChild(trf)
    console.log(allFiles)
    //
    var checks = document.querySelectorAll("input.checkGet")

    console.log(checks.length)
    filesToGet.length = checks.length
    filesToGet.fill(false)
    console.log(checks.length, filesToGet.length)

    checks = document.querySelectorAll("input.checkDel")
    //  for (var i=0; i!=checksDel.length; i++ ){
    //     checksDel[i].addEventListener("click",  delFiles(i) )
    //  };  
    filesToDel.length = (checks.length)
    filesToDel.fill(false)
}  // FIN function populate( fileList ){
// ******************************************************************************************************

async function downloadFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
        return;
    }
    const query = files.map(encodeURIComponent).join(',');
    const url = `/upload?f=${query}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`GET ${url} -> ${response.status}`);
        }
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const fallbackName = files.length === 1 ? files[0] : `data_${Date.now()}.zip`;
        const filename = match ? match[1] : fallbackName;
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(blobUrl);
        document.body.removeChild(link);
    } catch (error) {
        logRequestError(`GET ${url}`, error);
    }
}
// ******************************************************************************************************

function delFileClicked() {
    var i=0, files = []
    //construit la liste des fichiers a supprimer
    filesToDel.forEach( value => {
            if (value ===true){
                console.log(i, allFiles[i])
                files.push(allFiles[i])
            }
            i++
    }    );
    console.log(files)
    if (files.length === 0) {
        return;
    }
    //supprime les fichiers choisis (colonne del)
    postQuery('delfile', files)
}  // FIN function delFileClicked() {
// ******************************************************************************************************

function getFileClicked() {
    var i=0, files = []
    // //construit la liste des fichiers a uploader
    filesToGet.forEach( value => {
            if (value ===true)
                files.push(allFiles[i])
            i++
    }    );  
    console.log(files, typeof files) // upload les fichiers choisis (colenne get)
    downloadFiles(files)
}  // FIN function getFileClicked() {
// ******************************************************************************************************

function zipFileClicked() {
    // recup du fichier zip
    window.location = '/tmp/out.zip';
}  // FIN function zipFileClicked() {
// ******************************************************************************************************

function postQuery(name, value) {
    const payload = (value === undefined) ? {} : { val: value };
    return cborRequest(name, { method: 'POST', body: payload })
        .then((data) => {
            if (name === 'delfile') {
                window.location.reload();
            }
            return data;
        })
        .catch((error) => {
            logRequestError(`POST ${name}`, error);
            return null;
        });
}  // FIN function postQuery(name, value) {
// ******************************************************************************************************
// maintient les listes de fichiers a suprimer, uploader

function getFiles(elmt){
    index = parseInt(elmt.value.substr(1))
    filesToGet[index] = ! filesToGet[index] 
    if (filesToGet[index] ===true)
        nbFilesToGet ++;
    else
        nbFilesToGet--;
    console.log( 'upload.js l 191 getFiles', filesToGet[index] , nbFilesToGet)     
    if (nbFilesToGet <= 1)
        document.getElementById('getButton').innerHTML = "get selected file"
    else 
        document.getElementById('getButton').innerHTML = "zip selected files"
    document.getElementById('getButton').disabled = !(nbFilesToGet > 0)
}  // FIN function getFiles(elmt){
// ******************************************************************************************************

function delFiles(elmt){
    index = parseInt(elmt.value.substr(1))
    filesToDel[index] = ! filesToDel[index] 
    if (filesToDel[index] ===true)
        nbFilesToDel ++;
    else
        nbFilesToDel--;
    console.log( 'delFiles', filesToDel[index] , nbFilesToDel)
    document.getElementById('delButton').disabled = !(nbFilesToDel > 0)
}   // FIN function delFiles(elmt){
// ******************************************************************************************************
