/*
 * Copyright (c) 2025 Vitor Pamplona
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type NamecoinValueFetcher = (name: string) => Promise<string | null>;

export interface NamecoinProfile {
    pubkey: string;
    relays?: string[];
}

type NamecoinObject = Record<string, unknown>;
type Namespace = 'domain' | 'identity';
type Operation = 'root' | 'import' | 'delegate';

interface ParsedIdentifier {
    namecoinName: string;
    localPart: string;
    namespace: Namespace;
    subdomainSelector: string;
}

interface ImportOperation {
    name: string;
    selector: string[];
}

type TraversalResult =
    | { kind: 'success'; value: NamecoinObject }
    | { kind: 'failure'; cyclic: boolean }
    | { kind: 'selectorNotFound'; selector: string };

const MAX_LOOKUPS = 16;
const MAX_DEPTH = 16;
const HEX_PUBKEY_REGEX = /^[0-9a-fA-F]{64}$/;
const LOCAL_PART_REGEX = /^[a-z0-9._-]+$/;
const APEX_REGEX = /^(?:xn--)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAP_LABEL_REGEX = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;
const NUMERIC_REGEX = /^[0-9]+$/;

function hasOwn(obj: NamecoinObject, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function getOwn(obj: NamecoinObject, key: string): unknown {
    return hasOwn(obj, key) ? obj[key] : undefined;
}

function matchesEntire(regex: RegExp, value: string): boolean {
    const match = regex.exec(value);
    return match !== null && match[0] === value;
}

function isObject(value: unknown): value is NamecoinObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function emptyObject(): NamecoinObject {
    return Object.create(null) as NamecoinObject;
}

function success(value: NamecoinObject): TraversalResult {
    return { kind: 'success', value };
}

function failure(cyclic: boolean = false): TraversalResult {
    return { kind: 'failure', cyclic };
}

function selectorNotFound(selector: string[]): TraversalResult {
    return { kind: 'selectorNotFound', selector: selector.join('.') };
}

function isAsciiPrintable(value: string): boolean {
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code < 33 || code > 126) return false;
    }
    return true;
}

function isValidApex(label: string): boolean {
    return (
        label.length >= 1 &&
        label.length <= 63 &&
        matchesEntire(APEX_REGEX, label) &&
        !matchesEntire(NUMERIC_REGEX, label)
    );
}

function isValidMapLabel(
    label: string,
    allowWildcard: boolean = false
): boolean {
    return (
        (allowWildcard && label === '*') ||
        (label.length >= 1 &&
            label.length <= 63 &&
            matchesEntire(MAP_LABEL_REGEX, label))
    );
}

function isValidReference(name: string): boolean {
    if (
        name.length < 3 ||
        name.length > 255 ||
        !name.includes('/') ||
        name.toLowerCase().endsWith('.bit') ||
        !isAsciiPrintable(name)
    ) {
        return false;
    }
    if (name.startsWith('d/')) return isValidApex(name.slice(2));
    return true;
}

function looksLikeNamecoinKey(value: string): boolean {
    return value.includes('/') && isValidReference(value);
}

function parseSelector(
    selector: string,
    allowWildcard: boolean
): string[] | null {
    if (selector.length === 0) return [];
    if (
        selector.length > 253 ||
        selector.startsWith('.') ||
        selector.endsWith('.')
    ) {
        return null;
    }
    const labels = selector.split('.');
    if (labels.some((label) => !isValidMapLabel(label, allowWildcard))) {
        return null;
    }
    return labels.map((label) => label.toLowerCase());
}

function parseBitHostname(
    raw: string,
    namespace: Namespace
): ParsedIdentifier | null {
    const trimmed = raw.trim();
    const input = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;
    if (input.length === 0 || input.length > 253) return null;

    const labels = input.toLowerCase().split('.');
    if (labels.length < 2 || labels[labels.length - 1] !== 'bit') return null;

    const apex = labels[labels.length - 2];
    if (!isValidApex(apex)) return null;

    const subdomains = labels.slice(0, -2);
    if (subdomains.some((label) => !isValidMapLabel(label))) return null;

    return {
        namecoinName: `d/${apex}`,
        localPart: '_',
        namespace,
        subdomainSelector: subdomains.join('.')
    };
}

function parseIdentifier(raw: string): ParsedIdentifier | null {
    const input = raw.trim();
    if (input.slice(0, 2).toLowerCase() === 'd/') {
        const normalized = input.toLowerCase();
        if (!isValidReference(normalized)) return null;
        return {
            namecoinName: normalized,
            localPart: '_',
            namespace: 'domain',
            subdomainSelector: ''
        };
    }
    if (input.slice(0, 3).toLowerCase() === 'id/') {
        const normalized = input.toLowerCase();
        if (
            normalized.length < 4 ||
            normalized.length > 255 ||
            !isAsciiPrintable(normalized)
        ) {
            return null;
        }
        return {
            namecoinName: normalized,
            localPart: '_',
            namespace: 'identity',
            subdomainSelector: ''
        };
    }

    const at = input.indexOf('@');
    if (at >= 0) {
        if (at !== input.lastIndexOf('@')) return null;
        const localText = input.slice(0, at).toLowerCase();
        const localPart = localText.length === 0 ? '_' : localText;
        if (!matchesEntire(LOCAL_PART_REGEX, localPart)) return null;
        const host = parseBitHostname(input.slice(at + 1), 'domain');
        if (host === null) return null;
        return { ...host, localPart };
    }

    return parseBitHostname(input, 'domain');
}

function parseOperation(
    name: string,
    selector: string
): ImportOperation | null {
    if (!isValidReference(name)) return null;
    const labels = parseSelector(selector, true);
    if (labels === null) return null;
    return { name, selector: labels };
}

function parseOperations(item: unknown): ImportOperation[] | null {
    if (typeof item === 'string') {
        const operation = parseOperation(item, '');
        return operation === null ? null : [operation];
    }
    if (!Array.isArray(item)) return null;
    if (item.length === 0) return [];

    if (item.every((element) => typeof element === 'string')) {
        const strings = item as string[];
        if (
            strings.length === 2 &&
            looksLikeNamecoinKey(strings[0]) &&
            !looksLikeNamecoinKey(strings[1])
        ) {
            const operation = parseOperation(strings[0], strings[1]);
            return operation === null ? null : [operation];
        }

        const operations: ImportOperation[] = [];
        for (const name of strings) {
            const operation = parseOperation(name, '');
            if (operation === null) return null;
            operations.push(operation);
        }
        return operations;
    }

    const operations: ImportOperation[] = [];
    for (const element of item) {
        if (
            !Array.isArray(element) ||
            element.length < 1 ||
            element.length > 2
        ) {
            return null;
        }
        if (typeof element[0] !== 'string') return null;
        const selector = element.length === 2 ? element[1] : '';
        if (typeof selector !== 'string') return null;
        const operation = parseOperation(element[0], selector);
        if (operation === null) return null;
        operations.push(operation);
    }
    return operations;
}

function removeKey(obj: NamecoinObject, keyToRemove: string): NamecoinObject {
    if (!hasOwn(obj, keyToRemove)) return obj;
    const out = emptyObject();
    for (const key of Object.keys(obj)) {
        if (key !== keyToRemove) out[key] = obj[key];
    }
    return out;
}

function replaceKey(
    obj: NamecoinObject,
    keyToReplace: string,
    newValue: unknown
): NamecoinObject {
    const out = emptyObject();
    for (const key of Object.keys(obj)) {
        out[key] = key === keyToReplace ? newValue : obj[key];
    }
    return out;
}

function removeDefaultMapEntry(
    obj: NamecoinObject,
    map: NamecoinObject
): NamecoinObject {
    const newMap = emptyObject();
    for (const key of Object.keys(map)) {
        if (key.length > 0) newMap[key] = map[key];
    }
    return replaceKey(obj, 'map', newMap);
}

function mergeImporterWins(
    importer: NamecoinObject,
    imported: NamecoinObject
): NamecoinObject {
    if (Object.keys(imported).length === 0) return importer;
    if (Object.keys(importer).length === 0) return imported;

    const out = emptyObject();
    for (const key of Object.keys(imported)) out[key] = imported[key];
    for (const key of Object.keys(importer)) out[key] = importer[key];
    return out;
}

class NamecoinTraversal {
    private readonly lookupMemo = new Map<string, TraversalResult>();
    private readonly resolutionMemo = new Map<string, TraversalResult>();
    private readonly activeReferences = new Set<string>();
    private lookupCount = 0;

    constructor(private readonly fetcher: NamecoinValueFetcher) {}

    async resolve(
        namecoinName: string,
        selector: string
    ): Promise<TraversalResult> {
        const labels = parseSelector(selector, true);
        if (labels === null) return failure();
        return this.resolveReference(
            namecoinName,
            namecoinName,
            labels,
            0,
            'root'
        );
    }

    private async resolveReference(
        _sourceName: string,
        targetName: string,
        selector: string[],
        depth: number,
        operation: Operation
    ): Promise<TraversalResult> {
        if (depth > MAX_DEPTH) return failure();

        const visitKey = `${targetName}|${selector.join('.')}`;
        const memoKey = `${visitKey}@${depth}`;
        if (operation !== 'root') {
            const memoized = this.resolutionMemo.get(memoKey);
            if (memoized !== undefined) return memoized;
        }

        if (this.activeReferences.has(visitKey)) return failure(true);
        this.activeReferences.add(visitKey);

        try {
            const loaded = await this.lookupRecord(targetName);
            if (loaded.kind === 'failure') return loaded;
            if (loaded.kind === 'selectorNotFound') return failure();

            const resolved = await this.resolveObject(
                loaded.value,
                targetName,
                selector,
                depth
            );
            if (resolved.kind === 'selectorNotFound' && operation !== 'root') {
                return failure();
            }
            if (
                operation !== 'root' &&
                !(resolved.kind === 'failure' && resolved.cyclic)
            ) {
                this.resolutionMemo.set(memoKey, resolved);
            }
            return resolved;
        } finally {
            this.activeReferences.delete(visitKey);
        }
    }

    private async lookupRecord(name: string): Promise<TraversalResult> {
        const memoized = this.lookupMemo.get(name);
        if (memoized !== undefined) return memoized;
        if (this.lookupCount >= MAX_LOOKUPS) return failure();
        this.lookupCount += 1;

        let result: TraversalResult;
        try {
            const raw = await this.fetcher(name);
            if (raw === null) {
                result = failure();
            } else {
                try {
                    const parsed: unknown = JSON.parse(raw);
                    result = isObject(parsed) ? success(parsed) : failure();
                } catch {
                    result = failure();
                }
            }
        } catch {
            result = failure();
        }

        this.lookupMemo.set(name, result);
        return result;
    }

    private async resolveObject(
        raw: NamecoinObject,
        currentName: string,
        selector: string[],
        depth: number
    ): Promise<TraversalResult> {
        if (depth > MAX_DEPTH) return failure();

        if (hasOwn(raw, 'delegate')) {
            const delegateItem = getOwn(raw, 'delegate');
            if (delegateItem !== null) {
                const operations = parseOperations(delegateItem);
                if (operations === null || operations.length !== 1) {
                    return failure();
                }
                const operation = operations[0];
                return this.resolveReference(
                    currentName,
                    operation.name,
                    [...selector, ...operation.selector],
                    depth + 1,
                    'delegate'
                );
            }
        }

        const withDefaults = await this.expandDefaultMap(
            raw,
            currentName,
            depth
        );
        if (withDefaults.kind !== 'success') return withDefaults;

        const merged = await this.expandImports(
            withDefaults.value,
            currentName,
            depth
        );
        if (merged.kind !== 'success') return merged;

        return this.selectSubdomain(merged.value, currentName, selector, depth);
    }

    private async expandDefaultMap(
        obj: NamecoinObject,
        currentName: string,
        depth: number
    ): Promise<TraversalResult> {
        if (!hasOwn(obj, 'map')) return success(obj);
        const mapElement = getOwn(obj, 'map');
        if (mapElement === null) return success(obj);
        if (!isObject(mapElement)) return failure();
        if (!hasOwn(mapElement, '')) return success(obj);

        const defaultElement = getOwn(mapElement, '');
        const withoutDefault = removeDefaultMapEntry(obj, mapElement);
        if (defaultElement === null) return success(withoutDefault);

        let defaultObject: NamecoinObject;
        if (isObject(defaultElement)) {
            defaultObject = defaultElement;
        } else if (typeof defaultElement === 'string') {
            defaultObject = emptyObject();
        } else {
            return failure();
        }

        const expanded = await this.resolveObject(
            defaultObject,
            currentName,
            [],
            depth + 1
        );
        if (expanded.kind !== 'success') return expanded;
        return success(mergeImporterWins(withoutDefault, expanded.value));
    }

    private async expandImports(
        obj: NamecoinObject,
        currentName: string,
        depth: number
    ): Promise<TraversalResult> {
        if (!hasOwn(obj, 'import')) return success(obj);
        const importItem = getOwn(obj, 'import');
        if (importItem === null) {
            return success(removeKey(obj, 'import'));
        }
        const operations = parseOperations(importItem);
        if (operations === null) return failure();

        let accumulator = emptyObject();
        for (const operation of operations) {
            const imported = await this.resolveReference(
                currentName,
                operation.name,
                operation.selector,
                depth + 1,
                'import'
            );
            if (imported.kind !== 'success') return imported;
            accumulator = mergeImporterWins(accumulator, imported.value);
        }

        return success(
            mergeImporterWins(removeKey(obj, 'import'), accumulator)
        );
    }

    private async selectSubdomain(
        obj: NamecoinObject,
        currentName: string,
        selector: string[],
        depth: number
    ): Promise<TraversalResult> {
        if (selector.length === 0) return success(obj);
        if (!hasOwn(obj, 'map')) return selectorNotFound(selector);
        const mapElement = getOwn(obj, 'map');
        if (mapElement === null) return selectorNotFound(selector);
        if (!isObject(mapElement)) return failure();

        const label = selector[selector.length - 1];
        const exact = hasOwn(mapElement, label)
            ? getOwn(mapElement, label)
            : undefined;
        const wildcard = hasOwn(mapElement, '*')
            ? getOwn(mapElement, '*')
            : undefined;
        const child =
            exact !== undefined && exact !== null
                ? exact
                : wildcard !== undefined && wildcard !== null
                ? wildcard
                : undefined;
        if (child === undefined) return selectorNotFound(selector);

        let childObject: NamecoinObject;
        if (isObject(child)) {
            childObject = child;
        } else if (typeof child === 'string') {
            childObject = emptyObject();
        } else {
            return failure();
        }

        return this.resolveObject(
            childObject,
            currentName,
            selector.slice(0, -1),
            depth + 1
        );
    }
}

function primitiveContent(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return null;
}

function isValidPubkey(value: string): boolean {
    return matchesEntire(HEX_PUBKEY_REGEX, value);
}

function relayArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const relays: string[] = [];
    for (const item of value) {
        const content = primitiveContent(item);
        if (content !== null) relays.push(content);
    }
    return relays;
}

function extractRelayArray(nostr: NamecoinObject): string[] {
    return relayArray(getOwn(nostr, 'relays'));
}

function extractRelays(nostr: NamecoinObject, pubkey: string): string[] {
    const relaysMap = getOwn(nostr, 'relays');
    if (!isObject(relaysMap)) return [];

    const lowercased = pubkey.toLowerCase();
    const relayValue = hasOwn(relaysMap, lowercased)
        ? getOwn(relaysMap, lowercased)
        : getOwn(relaysMap, pubkey);
    return relayArray(relayValue);
}

function makeProfile(pubkey: string, relays: string[] = []): NamecoinProfile {
    const profile: NamecoinProfile = { pubkey: pubkey.toLowerCase() };
    if (relays.length > 0) profile.relays = relays;
    return profile;
}

function extractFromDomainValue(
    value: NamecoinObject,
    parsed: ParsedIdentifier
): NamecoinProfile | null {
    const nostrField = getOwn(value, 'nostr');
    if (typeof nostrField === 'string') {
        if (parsed.localPart === '_' && isValidPubkey(nostrField)) {
            return makeProfile(nostrField);
        }
        if (parsed.localPart !== '_') return null;
    }

    if (!isObject(nostrField)) return null;
    const namesField = getOwn(nostrField, 'names');
    if (isObject(namesField)) {
        const exact = primitiveContent(getOwn(namesField, parsed.localPart));
        const root = primitiveContent(getOwn(namesField, '_'));
        let matched: { localPart: string; pubkey: string } | null = null;

        if (exact !== null && isValidPubkey(exact)) {
            matched = { localPart: parsed.localPart, pubkey: exact };
        } else if (root !== null && isValidPubkey(root)) {
            matched = { localPart: '_', pubkey: root };
        } else if (parsed.localPart === '_') {
            const firstKey = Object.keys(namesField)[0];
            if (firstKey !== undefined) {
                const first = primitiveContent(getOwn(namesField, firstKey));
                if (first !== null && isValidPubkey(first)) {
                    matched = { localPart: firstKey, pubkey: first };
                }
            }
        }

        if (matched !== null) {
            return makeProfile(
                matched.pubkey,
                extractRelays(nostrField, matched.pubkey)
            );
        }
        if (parsed.localPart !== '_') return null;
    }

    if (parsed.localPart === '_') {
        const pubkey = primitiveContent(getOwn(nostrField, 'pubkey'));
        if (pubkey !== null && isValidPubkey(pubkey)) {
            return makeProfile(pubkey, extractRelayArray(nostrField));
        }
    }
    return null;
}

function extractFromIdentityValue(
    value: NamecoinObject
): NamecoinProfile | null {
    const nostrField = getOwn(value, 'nostr');
    if (typeof nostrField === 'string' && isValidPubkey(nostrField)) {
        return makeProfile(nostrField);
    }
    if (!isObject(nostrField)) return null;

    const pubkey = primitiveContent(getOwn(nostrField, 'pubkey'));
    if (pubkey !== null && isValidPubkey(pubkey)) {
        return makeProfile(pubkey, extractRelayArray(nostrField));
    }

    const names = getOwn(nostrField, 'names');
    if (isObject(names)) {
        const root = primitiveContent(getOwn(names, '_'));
        if (root !== null && isValidPubkey(root)) {
            return makeProfile(root, extractRelays(nostrField, root));
        }
    }
    return null;
}

export function isNamecoinIdentifier(input: string): boolean {
    const normalized = input.trim().toLowerCase();
    return (
        normalized.endsWith('.bit') ||
        normalized.endsWith('.bit.') ||
        normalized.startsWith('d/') ||
        normalized.startsWith('id/')
    );
}

export async function resolveNamecoinProfile(
    identifier: string,
    fetcher: NamecoinValueFetcher
): Promise<NamecoinProfile | null> {
    try {
        const parsed = parseIdentifier(identifier);
        if (parsed === null) return null;

        const traversal = new NamecoinTraversal(fetcher);
        const selected = await traversal.resolve(
            parsed.namecoinName,
            parsed.subdomainSelector
        );
        if (selected.kind !== 'success') return null;

        return parsed.namespace === 'domain'
            ? extractFromDomainValue(selected.value, parsed)
            : extractFromIdentityValue(selected.value);
    } catch {
        return null;
    }
}
