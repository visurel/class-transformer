"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
var chai_1 = require("chai");
var index_1 = require("../../src/index");
var storage_1 = require("../../src/storage");
var decorators_1 = require("../../src/decorators");
var moment = require("moment");
var TransformOperationExecutor_1 = require("../../src/TransformOperationExecutor");
describe("custom transformation decorator", function () {
    it("@Expose decorator with \"name\" option should work with @Transform decorator", function () {
        storage_1.defaultMetadataStorage.clear();
        var User = /** @class */ (function () {
            function User() {
            }
            __decorate([
                decorators_1.Expose({ name: "user_name" }),
                decorators_1.Transform(function (value) { return value.toUpperCase(); }),
                __metadata("design:type", String)
            ], User.prototype, "name", void 0);
            return User;
        }());
        var plainUser = {
            user_name: "Johny Cage"
        };
        var classedUser = index_1.plainToClass(User, plainUser);
        classedUser.name.should.be.equal("JOHNY CAGE");
    });
    it("@Transform decorator logic should be executed depend of toPlainOnly and toClassOnly set", function () {
        storage_1.defaultMetadataStorage.clear();
        var User = /** @class */ (function () {
            function User() {
            }
            __decorate([
                decorators_1.Transform(function (value) { return value.toString(); }, { toPlainOnly: true }),
                decorators_1.Transform(function (value) { return moment(value); }, { toClassOnly: true }),
                __metadata("design:type", Date)
            ], User.prototype, "date", void 0);
            return User;
        }());
        var plainUser = {
            id: 1,
            name: "Johny Cage",
            date: new Date().valueOf()
        };
        var user = new User();
        user.id = 1;
        user.name = "Johny Cage";
        user.date = new Date();
        var classedUser = index_1.plainToClass(User, plainUser);
        classedUser.should.be.instanceOf(User);
        classedUser.id.should.be.equal(1);
        classedUser.name.should.be.equal("Johny Cage");
        moment.isMoment(classedUser.date).should.be.true;
        var plainedUser = index_1.classToPlain(user);
        plainedUser.should.not.be.instanceOf(User);
        plainedUser.should.be.eql({
            id: 1,
            name: "Johny Cage",
            date: user.date.toString()
        });
    });
    it("versions and groups should work with @Transform decorator too", function () {
        storage_1.defaultMetadataStorage.clear();
        var User = /** @class */ (function () {
            function User() {
            }
            __decorate([
                decorators_1.Type(function () { return Date; }),
                decorators_1.Transform(function (value) { return moment(value); }, { since: 1, until: 2 }),
                __metadata("design:type", Date)
            ], User.prototype, "date", void 0);
            __decorate([
                decorators_1.Type(function () { return Date; }),
                decorators_1.Transform(function (value) { return value.toString(); }, { groups: ["user"] }),
                __metadata("design:type", Date)
            ], User.prototype, "lastVisitDate", void 0);
            return User;
        }());
        var plainUser = {
            id: 1,
            name: "Johny Cage",
            date: new Date().valueOf(),
            lastVisitDate: new Date().valueOf()
        };
        var classedUser1 = index_1.plainToClass(User, plainUser);
        classedUser1.should.be.instanceOf(User);
        classedUser1.id.should.be.equal(1);
        classedUser1.name.should.be.equal("Johny Cage");
        moment.isMoment(classedUser1.date).should.be.true;
        var classedUser2 = index_1.plainToClass(User, plainUser, { version: 0.5 });
        classedUser2.should.be.instanceOf(User);
        classedUser2.id.should.be.equal(1);
        classedUser2.name.should.be.equal("Johny Cage");
        classedUser2.date.should.be.instanceof(Date);
        var classedUser3 = index_1.plainToClass(User, plainUser, { version: 1 });
        classedUser3.should.be.instanceOf(User);
        classedUser3.id.should.be.equal(1);
        classedUser3.name.should.be.equal("Johny Cage");
        moment.isMoment(classedUser3.date).should.be.true;
        var classedUser4 = index_1.plainToClass(User, plainUser, { version: 2 });
        classedUser4.should.be.instanceOf(User);
        classedUser4.id.should.be.equal(1);
        classedUser4.name.should.be.equal("Johny Cage");
        classedUser4.date.should.be.instanceof(Date);
        var classedUser5 = index_1.plainToClass(User, plainUser, { groups: ["user"] });
        classedUser5.should.be.instanceOf(User);
        classedUser5.id.should.be.equal(1);
        classedUser5.name.should.be.equal("Johny Cage");
        classedUser5.lastVisitDate.should.be.equal(new Date(plainUser.lastVisitDate).toString());
    });
    it("@Transform decorator callback should be given correct arguments", function () {
        storage_1.defaultMetadataStorage.clear();
        var objArg;
        var typeArg;
        function transformCallback(value, obj, type) {
            objArg = obj;
            typeArg = type;
            return value;
        }
        var User = /** @class */ (function () {
            function User() {
            }
            __decorate([
                decorators_1.Transform(transformCallback, { toPlainOnly: true }),
                decorators_1.Transform(transformCallback, { toClassOnly: true }),
                __metadata("design:type", String)
            ], User.prototype, "name", void 0);
            return User;
        }());
        var plainUser = {
            name: "Johny Cage",
        };
        index_1.plainToClass(User, plainUser);
        objArg.should.be.equal(plainUser);
        typeArg.should.be.equal(TransformOperationExecutor_1.TransformationType.PLAIN_TO_CLASS);
        var user = new User();
        user.name = "Johny Cage";
        index_1.classToPlain(user);
        objArg.should.be.equal(user);
        typeArg.should.be.equal(TransformOperationExecutor_1.TransformationType.CLASS_TO_PLAIN);
    });
    var model;
    it("should serialize json into model instance of class Person", function () {
        chai_1.expect(function () {
            var json = {
                name: "John Doe",
                address: {
                    street: "Main Street 25",
                    tel: "5454-534-645",
                    zip: 10353,
                    country: "West Samoa"
                },
                age: 25,
                hobbies: [
                    { type: "sport", name: "sailing" },
                    { type: "relax", name: "reading" },
                    { type: "sport", name: "jogging" },
                    { type: "relax", name: "movies" }
                ]
            };
            var Hobby = /** @class */ (function () {
                function Hobby() {
                }
                return Hobby;
            }());
            var Address = /** @class */ (function () {
                function Address() {
                }
                __decorate([
                    decorators_1.Expose({ name: "tel" }),
                    __metadata("design:type", String)
                ], Address.prototype, "telephone", void 0);
                return Address;
            }());
            var Person = /** @class */ (function () {
                function Person() {
                }
                __decorate([
                    decorators_1.Type(function () { return Address; }),
                    __metadata("design:type", Address)
                ], Person.prototype, "address", void 0);
                __decorate([
                    decorators_1.Type(function () { return Hobby; }),
                    decorators_1.Transform(function (value) { return value.filter(function (hobby) { return hobby.type === "sport"; }); }, { toClassOnly: true }),
                    __metadata("design:type", Array)
                ], Person.prototype, "hobbies", void 0);
                return Person;
            }());
            model = index_1.plainToClass(Person, json);
            chai_1.expect(model instanceof Person);
            chai_1.expect(model.address instanceof Address);
            model.hobbies.forEach(function (hobby) { return chai_1.expect(hobby instanceof Hobby && hobby.type === "sport"); });
        }).to.not.throw();
    });
    it("should serialize a model into json", function () {
        chai_1.expect(function () {
            index_1.classToPlain(model);
        }).to.not.throw();
    });
});
//# sourceMappingURL=custom-transform.spec.js.map