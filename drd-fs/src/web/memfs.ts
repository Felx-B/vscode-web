/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
  Disposable,
  EventEmitter,
  FileChangeEvent,
  FileChangeType,
  FileStat,
  FileSystemError,
  FileSystemProvider,
  FileType,
  Uri,
} from "vscode";

import { XMLParser } from "fast-xml-parser";

export interface WebDavOptions {
  basicAuthApikey?: string;
  accessToken?: string;
  prefix?: string;
}

export class File implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  data?: Uint8Array;

  constructor(public uri: Uri, name: string) {
    this.type = FileType.File;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
  }
}

export class Directory implements FileStat {
  type: FileType;
  ctime: number;
  mtime: number;
  size: number;

  name: string;
  entries: Map<string, File | Directory>;

  constructor(public uri: Uri, name: string) {
    this.type = FileType.Directory;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
    this.name = name;
    this.entries = new Map();
  }
}

export type Entry = File | Directory;

export class MemFS implements FileSystemProvider, Disposable {
  static scheme = "memfs";
  private wedavUrl: string;
  private _isInitialized = false;
  private _emitter = new EventEmitter<FileChangeEvent[]>();
  private readonly disposables: Disposable[] = [];

  get webdavUrl(): string {
    return this.wedavUrl;
  }

  set webdavUrl(value: string) {
    this.wedavUrl = value.replace(/\/$/, "");
  }

  constructor(wedavUrl: string, private webdavOptions?: WebDavOptions) {
    //set the webdav url but strip the trailing slash, if any
    this.wedavUrl = wedavUrl.replace(/\/$/, "");
    this.disposables.push(this._emitter);

    // Mark as initialized if we have both URL and credentials
    this._isInitialized = !!(
      wedavUrl &&
      (webdavOptions?.basicAuthApikey || webdavOptions?.accessToken)
    );
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }

  private ensureInitialized(): void {
    if (!this._isInitialized) {
      throw FileSystemError.Unavailable(
        "File system not yet initialized. Please configure credentials first."
      );
    }
  }

  private getAuthHeader() {
    if (this.webdavOptions?.accessToken) {
      return "Bearer " + this.webdavOptions.accessToken;
    }
    if (this.webdavOptions?.basicAuthApikey) {
      const username = "apikey";
      const password = this.webdavOptions.basicAuthApikey;
      return "Basic " + btoa(username + ":" + password);
    }
    return undefined;
  }

  async davRequest(path: string, options: RequestInit) {
    const authHeader = this.getAuthHeader();

    const { prefix = "" } = this.webdavOptions || {};

    const base = this.wedavUrl + prefix;

    const req = await fetch(base + path, {
      ...options,
      headers: new Headers({
        ...(options.headers || {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      }),
    });

    if (req.status === 404) {
      throw FileSystemError.FileNotFound();
    }

    if (!req.ok) {
      throw new Error("Failed to read directory");
    }
    return req;
  }

  async readDavDirectory(path = "/") {
    const req = await this.davRequest(path, {
      headers: {
        Depth: "1",
      },
      method: "PROPFIND",
      body: `<?xml version="1.0" encoding="utf-8" ?>
<propfind xmlns="DAV:">
  <prop>
    <getlastmodified xmlns="DAV:"/>
    <getcontentlength xmlns="DAV:"/>
    <resourcetype xmlns="DAV:"/>
  </prop>
</propfind>`,
    });

    const text = await req.text();
    const parser = new XMLParser();
    //xmt to js object
    const obj = parser.parse(text);
    //console.log(obj);
    //debugger;
    let list = obj["D:multistatus"]["D:response"];

    if (!Array.isArray(list)) {
      list = [list];
    }

    //console.log(list);
    return list.map((item: any) => {
      const href = item["D:href"];
      let propstat = item["D:propstat"];

      if (!Array.isArray(propstat)) {
        propstat = [propstat];
      }

      const isDir = !!propstat.find((ps: any) => {
        return ps["D:prop"]?.["D:resourcetype"]?.["D:collection"] !== undefined;
      });

      let size = undefined;
      if (!isDir) {
        const sizeNode = propstat.find((ps: any) => {
          return ps["D:prop"]?.["D:getcontentlength"] !== undefined;
        });
        if (sizeNode) {
          size = sizeNode["D:prop"]["D:getcontentlength"];
        } else {
          size = 0;
        }
      }

      return {
        href: href,
        size: size,
        isDir: isDir,
      };
    }) as any[];
  }

  root = new Directory(Uri.parse("memfs:/"), "");

  async stat(uri: Uri): Promise<FileStat> {
    this.ensureInitialized();
    const data = await this.readDavDirectory(uri.path);

    if (data[0]) {
      return {
        type: !data[0]?.isDir ? FileType.File : FileType.Directory,
        ctime: 0,
        mtime: 0,
        size: data[0]?.size || 0,
      };
    }
    throw FileSystemError.FileNotFound();
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    this.ensureInitialized();
    const list = await this.readDavDirectory(uri.path);

    const { prefix = "" } = this.webdavOptions || {};
    const filtered = list
      .filter((item) => !prefix || item.href !== prefix)
      .filter((item) => !prefix || item.href !== prefix + "/")
      .filter((item) => item.href !== prefix + uri.path)
      .filter((item) => item.href !== prefix + uri.path + "/");

    return filtered.map((item) => {
      let fullpath = item.href;

      if (fullpath.endsWith("/")) {
        fullpath = fullpath.slice(0, -1);
      }

      return [
        fullpath.split("/").pop(),
        !item.isDir ? FileType.File : FileType.Directory,
      ] as [string, FileType];
    });
  }

  // --- manage file contents

  async readFile(uri: Uri): Promise<Uint8Array> {
    this.ensureInitialized();
    const res = await this.davRequest(uri.path, {
      method: "GET",
      body: undefined,
    });

    const arrayBuffer = await res.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ) {
    this.ensureInitialized();
    await this.davRequest(uri.path, {
      method: "PUT",
      body: content as any,
    });
  }

  // --- manage files/folders

  async rename(oldUri: Uri, newUri: Uri, options: { overwrite: boolean }) {
    this.ensureInitialized();
    const { prefix = "" } = this.webdavOptions || {};

    await this.davRequest(oldUri.path, {
      method: "MOVE",
      headers: {
        Destination: prefix + newUri.path,
      },
    });
  }

  async delete(uri: Uri) {
    this.ensureInitialized();
    await this.davRequest(uri.path, {
      method: "DELETE",
    });
  }

  async createDirectory(uri: Uri) {
    this.ensureInitialized();
    await this.davRequest(uri.path, {
      method: "MKCOL",
    });
  }

  async updateCredentials(options: WebDavOptions) {
    this.webdavOptions = options;
    this._isInitialized = !!(
      this.wedavUrl &&
      (options.basicAuthApikey || options.accessToken)
    );

    if (this._isInitialized) {
      // Fire change events to refresh any open files
      this._emitter.fire([
        {
          type: FileChangeType.Changed,
          uri: Uri.parse("memfs:/"),
        },
      ]);
    }
  }

  get onDidChangeFile() {
    return this._emitter.event;
  }

  watch(
    uri: Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    }
  ): Disposable {
    return new Disposable(() => {});
  }
}
