import fs from 'fs';
import glob from 'glob';
import os from 'os';
import path from 'path';
import readline from 'readline';

const deepPartialCode = `
type Builtin =
    | Date
    | Function
    | Uint8Array
    | string
    | number
    | boolean
    | undefined;

type DeepPartial<T> = T extends Builtin
    ? T
    : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : T extends {}
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : Partial<T>;
    `;

/**
 * This function performs some necessary modifications to the
 * generated TS files to make them compatible with the
 * actual JS request & response objects of the WASM client
 */

const typesDir = 'lib/types/proto';
const files = glob.sync(`${typesDir}/**/*.ts`);
files.forEach((file, i) => {
    const tempFile = `${typesDir}/temp-${i}.d.ts`;

    const reader = readline.createInterface({
        input: fs.createReadStream(file)
    });
    const writer = fs.createWriteStream(tempFile, {
        flags: 'a'
    });

    reader.on('line', (line) => {
        // remove this import since its usage is replaced below
        if (line === "import { Observable } from 'rxjs';") return;

        let newLine = line;

        // replace Observable<T> return value with onMessage & onError callbacks
        // before: monitor(request: MonitorRequest): Observable<SwapStatus>;
        // after: monitor(request: MonitorRequest, onMessage: (res: SwapStatus) => void, onError: (e: Error) => void): void;
        let match = newLine.match(/\): Observable<(.*)>/);
        if (match) {
            const replaceWith = `, onMessage?: (msg: ${match[1]}) => void, onError?: (err: Error) => void): void`;
            newLine = newLine.replace(match[0], replaceWith);
        }

        // remove Observable<T> around request values since JS doesn't support client streaming
        // before: sendToRoute(request: Observable<SendToRouteRequest>)
        // after: sendToRoute(request: SendToRouteRequest)
        match = newLine.match(/request: Observable<(\w*)>/);
        if (match) {
            const replaceWith = `request: ${match[1]}`;
            newLine = newLine.replace(match[0], replaceWith);
        }

        // wrap all request types with DeepPartial<> so that all fields are optional
        // before: request: GetInfoRequest
        // after: request: DeepPartial<GetInfoRequest>
        match = newLine.match(/request: (\w+)(\)|,|$)/);
        if (match) {
            const replaceWith = `request?: DeepPartial<${match[1]}>${match[2]}`;
            newLine = newLine.replace(match[0], replaceWith);
        }

        // replace "Uint8Array" type with "Uint8Array | string" because the WASM doesn't properly
        // parse the Uint8Array objects when converted to JSON
        match = newLine.match(/: Uint8Array/);
        if (match) {
            const replaceWith = `: Uint8Array | string`;
            newLine = newLine.replace(match[0], replaceWith);
        }

        writer.write(newLine);
        writer.write(os.EOL);
    });

    reader.on('close', () => {
        // inject the DeepPartial type manually because we would need to include
        // a bunch of JS code in order to have it injected by the ts-proto plugin
        writer.write(deepPartialCode);
        writer.end();

        fs.renameSync(tempFile, file);
    });
});

/**
 * Reads the schema files in order to extract which methods are server streaming.
 * We do this in order to generate the streaming.ts file which is used to determine
 * if the Proxy should call 'request' or 'subscribe'. The only other solution
 * would be to either hard-code the subscription methods, which increases the
 * maintenance burden on updates, or to generate JS code which increases the
 * bundle size. This build-time approach which only includes a small additional
 * file felt like a worthy trade-off.
 */
const services: Record<string, Record<string, string>> = {};
const subscriptionMethods: string[] = [];
const pkgFiles: Record<string, string[]> = {};

const schemaDir = 'lib/types/schema';
const schemaFiles = glob.sync(`${schemaDir}/**/*.ts`);
schemaFiles.forEach((file) => {
    // get all of the exports from the generated file
    const imports = require(`../${file}`);
    // find the service definition export name (ex: SwapClientDefinition)
    const definitionName = Object.keys(imports).find((i) =>
        i.endsWith('Definition')
    );
    if (!definitionName) return;
    // get a reference to the actual definition object
    const serviceDef = imports[definitionName];

    // add the package name to the services object
    const pkgName = imports.protobufPackage;
    if (!services[pkgName]) services[pkgName] = {};
    services[pkgName][serviceDef.name] = serviceDef.fullName;

    // add the package file to the pkgFiles object
    if (!pkgFiles[pkgName]) pkgFiles[pkgName] = [];
    pkgFiles[pkgName].push(file.replace(schemaDir, ''));

    // extract subscription methods into the array
    Object.values(serviceDef.methods).forEach((m: any) => {
        if (m.responseStream) {
            subscriptionMethods.push(`${serviceDef.fullName}.${m.name}`);
        }
    });
});

// create the schema.ts file
const schemaContent = `
    // This file is auto-generated by the 'process_types.ts' script

    // Collection of service names to avoid having to use magic strings for
    // the RPC services. If anything gets renamed in the protos, it'll
    // produce a compiler error
    export const serviceNames = ${JSON.stringify(services)};

    // This array contains the list of methods that are server streaming. It is 
    // used to determine if the Proxy should call 'request' or 'subscribe'. The 
    // only other solution would be to either hard-code the subscription methods,
    // which increases the maintenance burden on updates, or to have protoc generate JS code
    // which increases the bundle size. This build-time approach which only
    // includes a small additional file appears to be worthy trade-off
    export const subscriptionMethods = ${JSON.stringify(subscriptionMethods)};
`;
fs.writeFileSync(path.join(typesDir, 'schema.ts'), schemaContent);

const indexExports: string[] = [];
// create a file for each protobuf package (ex: looprpc.ts) which exports all the types
// from each of the generated files in that package
Object.entries(pkgFiles).forEach(([pkgName, paths]) => {
    const exportStmts = paths
        .map((f) => {
            const relPath = f.replace(path.extname(f), '');
            return `export * from '.${relPath}';`;
        })
        .join(os.EOL);
    const destPath = path.join(typesDir, `${pkgName}.ts`);
    fs.writeFileSync(destPath, exportStmts);

    // add a named import for this package to the array
    indexExports.push(`import * as ${pkgName} from './${pkgName}';`);
});

// create an index.ts file which re-exports all the types from the package files
const pkgNames = Object.keys(pkgFiles);
indexExports.push(`export { ${pkgNames.join(', ')} };`);
fs.writeFileSync(path.join(typesDir, 'index.ts'), indexExports.join(os.EOL));
