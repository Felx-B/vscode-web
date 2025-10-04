// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { MemFS, WebDavOptions } from "./memfs";

export async function activate(context: vscode.ExtensionContext) {
  // Create MemFS instance without auto-registration
  const memFs = new MemFS("", {}); // Start with empty URL and credentials

  // Register the file system provider immediately
  const fsRegistration = vscode.workspace.registerFileSystemProvider(
    "memfs",
    memFs,
    {
      isCaseSensitive: true,
    }
  );
  context.subscriptions.push(fsRegistration);
  context.subscriptions.push(memFs);

  // Get stored credentials
  let apikey = await context.secrets.get("druidfsprovider.apikey");
  let accessToken = await context.secrets.get("druidfsprovider.accessToken");
  let webdavUrl = await context.secrets.get("druidfsprovider.webdavUrl");
  let pathPrefix = await context.secrets.get("druidfsprovider.pathPrefix");

  // If we have credentials, configure the MemFS immediately
  if (webdavUrl && (apikey || accessToken)) {
    try {
      memFs.webdavUrl = webdavUrl;
      await memFs.updateCredentials({
        basicAuthApikey: apikey,
        accessToken,
        prefix: pathPrefix,
      });
      await memFs.readDavDirectory("/");

      // Add workspace folder if it's not already added
      const existingFolder = vscode.workspace.workspaceFolders?.find(
        (folder) => folder.uri.scheme === "memfs"
      );
      if (!existingFolder) {
        vscode.workspace.updateWorkspaceFolders(0, 0, {
          uri: vscode.Uri.parse("memfs:/"),
          name: "Druid - Filesystem",
        });
      }

      vscode.window.showInformationMessage("Connected to remote server.");
    } catch (error) {
      console.error("Failed to connect to remote server:", error);
      vscode.window.showErrorMessage(
        `Failed to connect to remote server: ${error}`
      );
    }
  }

  context.messagePassingProtocol?.postMessage({ type: "ready" });

  context.messagePassingProtocol?.onDidReceiveMessage(async (message) => {
    console.log("Received message:", message);
    if (message.type === "setCredentials") {
      try {
        vscode.window.showInformationMessage("Connecting to remote server...");

        // Store credentials for future sessions
        await context.secrets.store(
          "druidfsprovider.apikey",
          message.payload.apikey || ""
        );
        await context.secrets.store(
          "druidfsprovider.accessToken",
          message.payload.accessToken || ""
        );
        await context.secrets.store(
          "druidfsprovider.webdavUrl",
          message.payload.webdavUrl || ""
        );
        await context.secrets.store(
          "druidfsprovider.pathPrefix",
          message.payload.pathPrefix || ""
        );

        // Update credentials and URL
        memFs.webdavUrl = message.payload.webdavUrl as string;
        await memFs.updateCredentials({
          basicAuthApikey: message.payload.apikey,
          accessToken: message.payload.accessToken,
          prefix: message.payload.pathPrefix,
        });

        // Test the connection
        await memFs.readDavDirectory("/");

        // Add workspace folder if it's not already added
        const existingFolder = vscode.workspace.workspaceFolders?.find(
          (folder) => folder.uri.scheme === "memfs"
        );
        if (!existingFolder) {
          vscode.workspace.updateWorkspaceFolders(0, 0, {
            uri: vscode.Uri.parse("memfs:/"),
            name: "Druid - Filesystem",
          });
        }

        vscode.window.showInformationMessage("Connected to remote server.");
      } catch (error) {
        console.error("Failed to connect to remote server:", error);
        vscode.window.showErrorMessage(
          `Failed to connect to remote server: ${error}`
        );
      }
    }
  });
}

// This method is called when your extension is deactivated
export function deactivate() {}
