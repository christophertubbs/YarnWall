function doGet(request) {
  switch(request.pathInfo){
    case "index.html":
      const params = request.parameter || {};
      let t = HtmlService.createTemplateFromFile("index");
     
      if("input" in params){
        // Convert relative input path to absolute GAS URL...

        let baseUrl = ScriptApp.getService().getUrl();
        if (!baseUrl.endsWith("/")) {
          baseUrl += "/";
        }
        // Strip leading slashes from relativePath to avoid double slashes
        params.input = baseUrl + params.input.replace(/^\/+/, "");
      }

      params['_gasHeaders'] = {
        "Authorization": "Bearer " + ScriptApp.getOAuthToken()
      }

      t.requestParams = JSON.stringify(params);
      return t.evaluate().setTitle("YarnWall").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      break;
    default:
      if(request.pathInfo.startsWith('data/')){
        // Get a JSON data file from the folder and return its contents...

        const ROOT_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('ROOT_FOLDER_ID');
        
        let path = request.pathInfo.replace(/^data\/?/, "");

        if (!path) {
          return ContentService.createTextOutput(JSON.stringify({ error: "No file path specified" }))
            .setMimeType(ContentService.MimeType.JSON);
        }

        const pathParts = path.split("/").filter(Boolean);
        let currentFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);

        // Traverse subfolders up to the filename
        for (let i = 0; i < pathParts.length - 1; i++) {
          const subFolders = currentFolder.getFoldersByName(pathParts[i]);
          if (!subFolders.hasNext()) {
            return ContentService.createTextOutput(JSON.stringify({ error: "Folder not found: " + pathParts[i] }))
              .setMimeType(ContentService.MimeType.JSON);
          }
          currentFolder = subFolders.next();
        }

        // Get the target file
        const fileName = pathParts[pathParts.length - 1];
        const files = currentFolder.getFilesByName(fileName);

        if (files.hasNext()) {
          const fileContent = files.next().getBlob().getDataAsString();
          return ContentService.createTextOutput(fileContent)
            .setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput(JSON.stringify({ error: "File not found: " + fileName }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      break;
  }

}
