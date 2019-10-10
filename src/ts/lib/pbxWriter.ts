/**
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 'License'); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */

// import * as pbxProj from './pbxProject';
// var pbxProj = require('./pbxProject'),
import { format as f } from 'util';
// import * as util from 'util';
const INDENT = '\t';
    // COMMENT_KEY = /_comment$/;
// QUOTED = /^"(.*)"$/;
import { EventEmitter } from 'events';
import { SectionUtils } from "./SectionUtils";
import { XC_PROJ_UUID } from './IXcodeProjFileSimpleTypes';
import { SECTION_DICT, Section } from './IXcodeProjFile';
import { PBXObjectBase, cPBXBuildFile, cPBXFileReference } from './IXcodeProjFileObjTypes';

// indentation
function i(x: number): string {
    if (x <= 0)
        return '';
    else
        return INDENT + i(x - 1);
}

export type DICT_ANY = { [key: string]: any };

function comment(key: XC_PROJ_UUID, parent: DICT_ANY): string | null {

    const text: string | undefined = parent[key + '_comment'] as string | undefined;

    if (text)
        return text;
    else
        return null;
}

// copied from underscore
function isObject(obj: any): boolean {
    return obj === Object(obj);
}

function isArray(obj: any): boolean {
    return Array.isArray(obj);
}

export interface PbxWriterOptions {
    omitEmptyValues?: boolean;
}

export class PbxWriter extends EventEmitter {
    omitEmptyValues: boolean;
    indentLevel: number;
    sync: boolean;
    contents: any;
    buffer?: string;

    constructor(contents: any, options?: PbxWriterOptions) {
        super();

        if (!options) {
            options = {}
        }

        if (options.omitEmptyValues === undefined) {
            options.omitEmptyValues = false
        }

        this.contents = contents;
        this.sync = false;
        this.indentLevel = 0;
        this.omitEmptyValues = options.omitEmptyValues
    }

    write(...args: any[]): void {
        const fmt: string = f.apply(null, arguments as any);

        if (this.sync) {
            this.buffer += f("%s%s", i(this.indentLevel), fmt);
        } else {
            // do stream write
        }
    }

    writeFlush(...args: any[]): void {
        var oldIndent = this.indentLevel;

        this.indentLevel = 0;

        this.write(...args);
        //this.write.apply(this, arguments)

        this.indentLevel = oldIndent;
    }

    writeSync(): string {
        this.sync = true;
        this.buffer = "";

        this.writeHeadComment();
        this.writeProject();

        return this.buffer;
    }

    writeHeadComment(): void {
        if (this.contents.headComment) {
            this.write("// %s\n", this.contents.headComment)
        }
    }

    writeProject(): void {
        var proj = this.contents.project,
            key, cmt, obj;

        this.write("{\n")

        if (proj) {
            this.indentLevel++;

            for (key in proj) {
                // skip comments
                if (SectionUtils.dictKeyIsComment(key)) continue;

                cmt = comment(key, proj);
                obj = proj[key];

                if (isArray(obj)) {
                    this.writeArray(obj, key)
                } else if (isObject(obj)) {
                    this.write("%s = {\n", key);
                    this.indentLevel++;

                    if (key === 'objects') {
                        this.writeObjectsSections(obj)
                    } else {
                        this.writeObject(obj)
                    }

                    this.indentLevel--;
                    this.write("};\n");
                } else if (this.omitEmptyValues && (obj === undefined || obj === null)) {
                    continue;
                } else if (cmt) {
                    this.write("%s = %s /* %s */;\n", key, obj, cmt)
                } else {
                    this.write("%s = %s;\n", key, obj)
                }
            }

            this.indentLevel--;
        }

        this.write("}\n")
    }

    writeObject(object: DICT_ANY): void {

        for (let key in object) {
            if (SectionUtils.dictKeyIsComment(key)) continue;

            const cmt = comment(key, object);
            const obj = object[key];

            if (isArray(obj)) {
                this.writeArray(obj, key)
            } else if (isObject(obj)) {
                this.write("%s = {\n", key);
                this.indentLevel++;

                this.writeObject(obj)

                this.indentLevel--;
                this.write("};\n");
            } else {
                if (this.omitEmptyValues && (obj === undefined || obj === null)) {
                    continue;
                } else if (cmt) {
                    this.write("%s = %s /* %s */;\n", key, obj, cmt)
                } else {
                    this.write("%s = %s;\n", key, obj)
                }
            }
        }
    }

    writeObjectsSections(objects: SECTION_DICT): void {

        for (let ISA_TYPE in objects) {
            this.writeFlush("\n")

            const obj: Section = objects[ISA_TYPE];

            if (isObject(obj)) {
                this.writeSectionComment(ISA_TYPE, true);

                this.writeSection(obj);

                this.writeSectionComment(ISA_TYPE, false);
            }
        }
    }

    writeArray(arr: any[], name: string): void {

        this.write("%s = (\n", name);
        this.indentLevel++;

        for (let i = 0; i < arr.length; i++) {
            const entry: any = arr[i]

            if (entry.value && entry.comment) {
                this.write('%s /* %s */,\n', entry.value, entry.comment);
            } else if (isObject(entry)) {
                this.write('{\n');
                this.indentLevel++;

                this.writeObject(entry);

                this.indentLevel--;
                this.write('},\n');
            } else {
                this.write('%s,\n', entry);
            }
        }

        this.indentLevel--;
        this.write(");\n");
    }

    writeSectionComment(name: string, begin: boolean): void {
        if (begin) {
            this.writeFlush("/* Begin %s section */\n", name)
        } else { // end
            this.writeFlush("/* End %s section */\n", name)
        }
    }

    writeSection(section: Section): void {

        // section should only contain objects
        for (let key in section) {

            if (SectionUtils.dictKeyIsComment(key)) continue;

            const cmt: string | null = comment(key, section);
            const obj:PBXObjectBase = section[key] as PBXObjectBase;

            if (obj.isa == cPBXBuildFile || obj.isa == cPBXFileReference) {
                this.writeInlineObject(key, cmt, obj);
            } else {
                if (cmt) {
                    this.write("%s /* %s */ = {\n", key, cmt);
                } else {
                    this.write("%s = {\n", key);
                }

                this.indentLevel++

                this.writeObject(obj)

                this.indentLevel--
                this.write("};\n");
            }
        }
    }

    writeInlineObject(n:XC_PROJ_UUID, d:string|null, r:PBXObjectBase):void {
        const output:string[] = [];
        const self = this

        var inlineObjectHelper = function (name:XC_PROJ_UUID, desc:string|null, ref:PBXObjectBase):void {

            if (desc) {
                output.push(f("%s /* %s */ = {", name, desc));
            } else {
                output.push(f("%s = {", name));
            }

            for (let key in ref) {
                if (SectionUtils.dictKeyIsComment(key)) continue;

                const cmt:string|null = comment(key, ref);
                const obj:any = (ref as DICT_ANY)[key];

                if (isArray(obj)) {
                    output.push(f("%s = (", key));

                    for (var i = 0; i < obj.length; i++) {
                        output.push(f("%s, ", obj[i]))
                    }

                    output.push("); ");
                } else if (isObject(obj)) {
                    inlineObjectHelper(key, cmt, obj)
                } else if (self.omitEmptyValues && (obj === undefined || obj === null)) {
                    continue;
                } else if (cmt) {
                    output.push(f("%s = %s /* %s */; ", key, obj, cmt))
                } else {
                    output.push(f("%s = %s; ", key, obj))
                }
            }

            output.push("}; ");
        }

        inlineObjectHelper(n, d, r);

        this.write("%s\n", output.join('').trim());
    }
}

//module.exports = PbxWriter;
