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
/// <reference types="node" />
import { EventEmitter } from 'events';
import { XC_PROJ_UUID } from './IXcodeProjFileSimpleTypes';
import { SECTION_DICT, Section } from './IXcodeProjFile';
import { PBXObjectBase } from './IXcodeProjFileObjTypes';
export declare type DICT_ANY = {
    [key: string]: any;
};
export interface PbxWriterOptions {
    omitEmptyValues?: boolean;
}
export declare class PbxWriter extends EventEmitter {
    omitEmptyValues: boolean;
    indentLevel: number;
    sync: boolean;
    contents: any;
    buffer?: string;
    constructor(contents: any, options?: PbxWriterOptions);
    write(...args: any[]): void;
    writeFlush(...args: any[]): void;
    writeSync(): string;
    writeHeadComment(): void;
    writeProject(): void;
    writeObject(object: DICT_ANY): void;
    writeObjectsSections(objects: SECTION_DICT): void;
    writeArray(arr: any[], name: string): void;
    writeSectionComment(name: string, begin: boolean): void;
    writeSection(section: Section): void;
    writeInlineObject(n: XC_PROJ_UUID, d: string | null, r: PBXObjectBase): void;
}
