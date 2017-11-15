import {ClassTransformOptions} from "./ClassTransformOptions";
import {defaultMetadataStorage} from "./storage";
import {TypeOptions} from "./metadata/ExposeExcludeOptions";

export enum TransformationType {
    PLAIN_TO_CLASS,
    CLASS_TO_PLAIN,
    CLASS_TO_CLASS
}

export class TransformOperationExecutor {

    // -------------------------------------------------------------------------
    // Private Properties
    // -------------------------------------------------------------------------

    private transformedTypesMap = new Map<Object, {level: number, object: Object}>();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(private transformationType: TransformationType,
                private options: ClassTransformOptions) {
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    transform(source: Object|Object[]|any,
              value: Object|Object[]|any,
              targetType: Function,
              arrayType: Function,
              isMap: boolean,
              level: number = 0) {

        if (value instanceof Array || value instanceof Set) {
            const newValue = arrayType && this.transformationType === TransformationType.PLAIN_TO_CLASS ? new (arrayType as any)() : [];
            (value as any[]).forEach((subValue, index) => {
                const subSource = source ? source[index] : undefined;
                if (!this.options.enableCircularCheck || !this.isCircular(subValue, level)) {
                    const value = this.transform(subSource, subValue, targetType, undefined, subValue instanceof Map, level + 1);
                    if (newValue instanceof Set) {
                        newValue.add(value);
                    } else {
                        newValue.push(value);
                    }
                } else if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
                    if (newValue instanceof Set) {
                        newValue.add(subValue);
                    } else {
                        newValue.push(subValue);
                    }
                }
            });
            return newValue;

        } else if (targetType === String && !isMap) {
            return String(value);

        } else if (targetType === Number && !isMap) {
            return Number(value);

        } else if (targetType === Boolean && !isMap) {
            return Boolean(value);

        } else if ((targetType === Date || value instanceof Date) && !isMap) {
            if (value instanceof Date) {
                return new Date(value.valueOf());
            }
            if (value === null || value === undefined)
                return value;

            return new Date(value);

        } else if (value instanceof Object) {

            // try to guess the type
            if (!targetType && value.constructor !== Object/* && TransformationType === TransformationType.CLASS_TO_PLAIN*/) targetType = value.constructor;
            if (!targetType && source) targetType = source.constructor;

            if (this.options.enableCircularCheck) {
                // add transformed type to prevent circular references
                this.transformedTypesMap.set(value, {level: level, object: value});
            }

            const keys = this.getKeys(targetType, value);
            let newValue: any = source ? source : {};
            if (!source && (this.transformationType === TransformationType.PLAIN_TO_CLASS || this.transformationType === TransformationType.CLASS_TO_CLASS)) {
                if (isMap) {
                    newValue = new Map();
                } else if (targetType) {
                    newValue = new (targetType as any)();
                } else {
                    newValue = {};
                }
            }

            // traverse over keys
            for (let key of keys) {

                let valueKey = key, newValueKey = key, propertyName = key;
                if (!this.options.ignoreDecorators && targetType) {
                    if (this.transformationType === TransformationType.PLAIN_TO_CLASS) {
                        const exposeMetadata = defaultMetadataStorage.findExposeMetadataByCustomName(targetType, key);
                        if (exposeMetadata) {
                            propertyName = exposeMetadata.propertyName;
                            newValueKey = exposeMetadata.propertyName;
                        }

                    } else if (this.transformationType === TransformationType.CLASS_TO_PLAIN || this.transformationType === TransformationType.CLASS_TO_CLASS) {
                        const exposeMetadata = defaultMetadataStorage.findExposeMetadata(targetType, key);
                        if (exposeMetadata && exposeMetadata.options && exposeMetadata.options.name)
                            newValueKey = exposeMetadata.options.name;
                    }
                }

                // get a subvalue
                let subValue: any = undefined;
                if (value instanceof Map) {
                    subValue = value.get(valueKey);
                } else if (value[valueKey] instanceof Function) {
                    subValue = value[valueKey]();
                } else {
                    subValue = value[valueKey];
                }

                // determine a type
                let type: any = undefined, isSubValueMap = subValue instanceof Map;
                if (targetType && isMap) {
                    type = targetType;

                } else if (targetType) {
                    const metadata = defaultMetadataStorage.findTypeMetadata(targetType, propertyName);
                    if (metadata) {
                        const options: TypeOptions = {newObject: newValue, object: value, property: propertyName};
                        type = metadata.typeFunction(options);
                        isSubValueMap = isSubValueMap || metadata.reflectedType === Map;
                    } else if (this.options.targetMaps) { // try to find a type in target maps
                        this.options.targetMaps
                            .filter(map => map.target === targetType && !!map.properties[propertyName])
                            .forEach(map => type = map.properties[propertyName]);
                    }
                }

                // if value is an array try to get its custom array type
                const arrayType = value[valueKey] instanceof Array ? this.getReflectedType(targetType, propertyName) : undefined;
                // const subValueKey = TransformationType === TransformationType.PLAIN_TO_CLASS && newKeyName ? newKeyName : key;
                const subSource = source ? source[valueKey] : undefined;

                // if its deserialization then type if required
                // if we uncomment this types like string[] will not work
                // if (this.transformationType === TransformationType.PLAIN_TO_CLASS && !type && subValue instanceof Object && !(subValue instanceof Date))
                //     throw new Error(`Cannot determine type for ${(targetType as any).name }.${propertyName}, did you forget to specify a @Type?`);

                // if newValue is a source object that has method that match newKeyName then skip it
                if (newValue.constructor.prototype) {
                    const descriptor = Object.getOwnPropertyDescriptor(newValue.constructor.prototype, newValueKey);
                    if ((this.transformationType === TransformationType.PLAIN_TO_CLASS || this.transformationType === TransformationType.CLASS_TO_CLASS)
                        && (newValue[newValueKey] instanceof Function || (descriptor && !descriptor.set))) //  || TransformationType === TransformationType.CLASS_TO_CLASS
                        continue;
                }

                if (!this.options.enableCircularCheck || !this.isCircular(subValue, level)) {
                    let transformKey = this.transformationType === TransformationType.PLAIN_TO_CLASS ? newValueKey : key;
                    let finalValue = this.transform(subSource, subValue, type, arrayType, isSubValueMap, level + 1);
                    finalValue = this.applyCustomTransformations(finalValue, targetType, transformKey, value, this.transformationType);
                    if (newValue instanceof Map) {
                        newValue.set(newValueKey, finalValue);
                    } else {
                        newValue[newValueKey] = finalValue;
                    }
                } else if (this.transformationType === TransformationType.CLASS_TO_CLASS) {
                    let finalValue = subValue;
                    finalValue = this.applyCustomTransformations(finalValue, targetType, key, value, this.transformationType);
                    if (newValue instanceof Map) {
                        newValue.set(newValueKey, finalValue);
                    } else {
                        newValue[newValueKey] = finalValue;
                    }
                }

            }
            return newValue;

        } else {
            return value;
        }
    }

    private applyCustomTransformations(value: any, target: Function, key: string, obj: any, transformationType: TransformationType) {
        let metadatas = defaultMetadataStorage.findTransformMetadatas(target, key, this.transformationType);

        // apply versioning options
        if (this.options.version !== undefined) {
            metadatas = metadatas.filter(metadata => {
                if (!metadata.options)
                    return true;

                return this.checkVersion(metadata.options.since, metadata.options.until);
            });
        }

        // apply grouping options
        if (this.options.groups && this.options.groups.length) {
            metadatas = metadatas.filter(metadata => {
                if (!metadata.options)
                    return true;

                return this.checkGroups(metadata.options.groups);
            });
        } else {
            metadatas = metadatas.filter(metadata => {
                return !metadata.options || !metadata.options.groups || !metadata.options.groups.length;
            });
        }

        metadatas.forEach(metadata => {
            value = metadata.transformFn(value, obj, transformationType);
        });

        return value;
    }

    // preventing circular references
    private isCircular(object: Object, level: number) {
        const transformed = this.transformedTypesMap.get(object);
        return transformed !== undefined && transformed.level < level;
    }

    private getReflectedType(target: Function, propertyName: string) {
        if (!target) return undefined;
        const meta = defaultMetadataStorage.findTypeMetadata(target, propertyName);
        return meta ? meta.reflectedType : undefined;
    }

    private getKeys(target: Function, object: Object): string[] {

        // determine exclusion strategy
        let strategy = defaultMetadataStorage.getStrategy(target);
        if (strategy === "none")
            strategy = this.options.strategy || "exposeAll"; // exposeAll is default strategy

        // get all keys that need to expose
        let keys: any[] = [];
        if (strategy === "exposeAll") {
            if (object instanceof Map) {
                keys = Array.from(object.keys());
            } else {
                keys = Object.keys(object);
            }
        }

        if (!this.options.ignoreDecorators && target) {

            // add all exposed to list of keys
            let exposedProperties = defaultMetadataStorage.getExposedProperties(target, this.transformationType);
            if (this.transformationType === TransformationType.PLAIN_TO_CLASS) {
                exposedProperties = exposedProperties.map(key => {
                    const exposeMetadata = defaultMetadataStorage.findExposeMetadata(target, key);
                    if (exposeMetadata && exposeMetadata.options && exposeMetadata.options.name) {
                        return exposeMetadata.options.name;
                    }

                    return key;
                });
            }
            keys = keys.concat(exposedProperties);

            // exclude excluded properties
            const excludedProperties = defaultMetadataStorage.getExcludedProperties(target, this.transformationType);
            if (excludedProperties.length > 0) {
                keys = keys.filter(key => {
                    return excludedProperties.indexOf(key) === -1;
                });
            }

            // apply versioning options
            if (this.options.version !== undefined) {
                keys = keys.filter(key => {
                    const exposeMetadata = defaultMetadataStorage.findExposeMetadata(target, key);
                    if (!exposeMetadata || !exposeMetadata.options)
                        return true;

                    return this.checkVersion(exposeMetadata.options.since, exposeMetadata.options.until);
                });
            }

            // apply grouping options
            if (this.options.groups && this.options.groups.length) {
                keys = keys.filter(key => {
                    const exposeMetadata = defaultMetadataStorage.findExposeMetadata(target, key);
                    if (!exposeMetadata || !exposeMetadata.options)
                        return true;

                    return this.checkGroups(exposeMetadata.options.groups);
                });
            } else {
                keys = keys.filter(key => {
                    const exposeMetadata = defaultMetadataStorage.findExposeMetadata(target, key);
                    return !exposeMetadata || !exposeMetadata.options || !exposeMetadata.options.groups || !exposeMetadata.options.groups.length;
                });
            }
        }

        // exclude prefixed properties
        if (this.options.excludePrefixes && this.options.excludePrefixes.length) {
            keys = keys.filter(key => this.options.excludePrefixes.every(prefix => {
                return key.substr(0, prefix.length) !== prefix;
            }));
        }

        // make sure we have unique keys
        keys = keys.filter((key, index, self) => {
            return self.indexOf(key) === index;
        });

        return keys;
    }

    private checkVersion(since: number, until: number) {
        let decision = true;
        if (decision && since)
            decision = this.options.version >= since;
        if (decision && until)
            decision = this.options.version < until;

        return decision;
    }

    private checkGroups(groups: string[]) {
        if (!groups)
            return true;

        return this.options.groups.some(optionGroup => groups.indexOf(optionGroup) !== -1);
    }

}
