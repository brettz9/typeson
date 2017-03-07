var Typeson = require('./typeson');
var B64 = require ('base64-arraybuffer');

var typeson = new Typeson().register({
    Date: [
        function (x) { return x instanceof Date; },
        function (date) { return date.getTime(); },
        function (time) { return new Date(time); }
    ],
    Error: [
        function (x) { return x instanceof Error; },
        function (error) { return {name: error.name, message: error.message}; },
        function (data) {
            var e = new Error (data.message);
            e.name = data.name;
            return e;
        }
    ],
    SpecialNumber: [
        function (x) { return typeof x === 'number' && isNaN(x) || x === Infinity || x === -Infinity; },
        function (n) { return isNaN(n) ? "NaN" : n > 0 ? "Infinity" : "-Infinity" },
        function (s) { return {NaN: NaN, Infinity: Infinity, "-Infinity": -Infinity}[s];}
    ],
    ArrayBuffer: [
        function test (x) { return x.constructor === ArrayBuffer;},
        function encapsulate (b) { return B64.encode(b); },
        function revive (b64) { return B64.decode(b64); }
    ],
    DataView: [
        function (x) { return x instanceof DataView; },
        function (dw) { return { buffer: dw.buffer, byteOffset: dw.byteOffset, byteLength: dw.byteLength }; },
        function (obj) { return new DataView(obj.buffer, obj.byteOffset, obj.byteLength); }
    ]
});

var globalTypeson = typeson;

// The test framework I need:
function assert (x, msg) {
    if (!x) throw new Error(msg);
    console.log("  OK: " + msg);
};
function run(tests){tests.forEach(function(test){
    console.log(" ");
    console.log("Running test: " + test.name);
    test();
})}
function roundtrip(x) {
    var tson = typeson.stringify(x, null, 2);
    //console.log(tson);
    return typeson.parse(tson);
}

run ([function shouldSupportBasicTypes () {
    //
    // shouldSupportBasicTypes
    //
    var res = roundtrip({});
    assert(Object.keys(res).length === 0, "Result should be empty");
    var date = new Date();
    res = roundtrip({a: "a", b: 2, c: function(){}, d: false, e: Symbol(), f: [], g: date, h: /apa/gi });
    assert (res.a === "a", "String value");
    assert (res.b === 2, "Number value");
    assert (!res.c, "Functions should not follow by default");
    assert (res.d === false, "Boolean value");
    assert (!res.e, "Symbols should not follow by default");
    assert (Array.isArray(res.f) && res.f.length === 0, "Array value");
    assert (res.g instanceof Date && res.g.toString() == date.toString(), "Date value");
    
}, function shouldResolveCyclics() {
    //
    // shouldResolveCyclics
    //
    var data = {list: []};
    for (var i=0; i<10; ++i) {
        data.list.push({
            name: "name" + i,
            parent: data.list,
            root: data,
            children: []
        });
    }
    data.list[3].children = [data.list[0], data.list[1]];
    
    var tson = typeson.stringify(data,null, 2);
    //console.log(tson);
    var result = typeson.parse(tson);
    
    assert(data.list.length === 10, "Data.list.length should be 10");
    assert(data.list[3].children.length === 2, "data.list[3] should have 2 children");
    assert(data.list[3].children[0] === data.list[0], "First child of data.list[3] should be data.list[0]");
    
}, function shouldResolveCyclics2(){
    //
    // shouldResolveCyclics2
    //
    
    var kalle = {name: "Kalle", age: 33};
    var input = [kalle, kalle, kalle];
    var tson = typeson.stringify(input);
    //console.log (tson.match(/Kalle/g).length);
    console.log(tson);
    assert (tson.match(/Kalle/g).length === 1, "TSON should only contain one 'Kalle'. The other should just reference the first");
    var result = typeson.parse(tson);
    assert (result[0] === result[1] && result[1] === result[2], "The resulting object should also just have references to the same object");
    
}, function shouldResolveCyclicsArrays () {
    var recursive = [];
    recursive.push(recursive);
    var tson = typeson.stringify(recursive);
    var result = typeson.parse(tson);
    assert(result === result[0], "array directly contains self");

    var recursive2 = [];
    recursive2.push([recursive2]);

    tson = typeson.stringify(recursive2);
    result = typeson.parse(tson);
    assert(result !== result[0] && result === result[0][0], "array indirectly contains self");

    var recursive3 = [recursive];
    tson = typeson.stringify(recursive3);
    console.log(tson);
    result = typeson.parse(tson);

    assert(result !== result[0] && result !== result[0][0] && result[0] === result[0][0], "array member contains self");
}, function shouldNotResolveCyclicsIfNotWanted(){
    //
    // shouldNotResolveCyclicsIfNotWanted
    //

    var kalle = {name: "Kalle", age: 33};
    var input = [kalle, kalle, kalle];
    var typeson = new Typeson({cyclic: false});
    var tson = typeson.stringify(input);
    var json = JSON.stringify(input);
    assert (tson === json, "TSON should be identical to JSON because the input is simple and the cyclics of the input should be ignored");
    
}, function shouldSupportArrays(){
    //
    // shouldSupportArrays
    //
    var res = roundtrip([1,new Date(),3]);
    assert (res instanceof Array, "Result should be an array");
    assert (res.length === 3, "Should have length 3");
    assert (res[2] === 3, "Third item should be 3");
    
}, function shouldSupportIntermedateTypes() {
    function CustomDate(date) {
        this._date = date;
    }
    var typeson = new Typeson()
        .register(globalTypeson.types)
        .register({
            CustomDate: [
                x => x instanceof CustomDate,
                cd => cd._date,
                date => new CustomDate(date)
            ]
        });
    var date = new Date();
    var input = new CustomDate(new Date);
    var tson = typeson.stringify(input);
    console.log(tson);
    var back = typeson.parse(tson);
    assert (back instanceof CustomDate, "Should get CustomDate back");
    assert (back._date.getTime() === date.getTime(), "Should have correct value");
}, function shouldRunReplacersRecursively(){
    //
    // shouldRunReplacersRecursively
    //
    function CustomDate (date, name) {
        this._date = date;
        this.name = name;
        this.year = date.getFullYear();
    }
    CustomDate.prototype.getRealDate = function() {
        return this._date;
    }
    CustomDate.prototype.getName = function () {
        return this.name;
    }
    
    var date = new Date();
    
    var input = {
        name: "Karl",
        date: new CustomDate(date, "Otto")
    }
    
    var typeson = new Typeson()
        .register(globalTypeson.types)
        .register({
            CustomDate: [
                x => x instanceof CustomDate,
                cd => ({_date: cd.getRealDate(), name: cd.name}),
                obj => new CustomDate(obj._date, obj.name)
            ]
        });
    var tson = typeson.stringify(input,null, 2);
    console.log(tson);
    var result = typeson.parse(tson);
    assert (result.name == "Karl", "Basic prop");
    assert (result.date instanceof CustomDate, "Correct instance type of custom date");
    assert (result.date.getName() == "Otto", "prototype method works and properties seems to be in place");
    assert (result.date.getRealDate().getTime() === date.getTime(), "The correct time is there");
    
}, function shouldBeAbleToStringifyComplexObjectsAtRoot() {
    var x = roundtrip(new Date(3));
    assert (x instanceof Date, "x should be a Date");
    assert (x.getTime() === 3, "Time should be 3");
    var y = roundtrip([new Date(3)]);    
    assert (y[0] instanceof Date, "y[0] should be a Date");
    assert (y[0].getTime() === 3, "Time should be 3");
    
    function Custom () {
        this.x = "oops";
    }
    
    var TSON = new Typeson().register({
        Custom: [
            x => x instanceof Custom,
            s => false,
            f => new Custom()
        ]
    });
    var tson = TSON.stringify(new Custom());
    console.log(tson);
    var z = TSON.parse(tson);
    assert (z instanceof Custom && z.x === "oops", "Custom type encapsulated in bool should work");

    TSON = new Typeson().register({
        Custom: [
            x => x instanceof Custom,
            s => 42,
            f => new Custom()
        ]
    });
    tson = TSON.stringify(new Custom());
    console.log(tson);
    z = TSON.parse(tson);
    assert (z instanceof Custom && z.x === "oops", "Custom type encapsulated in bool should work");

    TSON = new Typeson().register({
        Custom: [
            x => x instanceof Custom,
            s => "foo",
            f => new Custom()
        ]
    });
    tson = TSON.stringify(new Custom());
    console.log(tson);
    z = TSON.parse(tson);
    assert (z instanceof Custom && z.x === "oops", "Custom type encapsulated in bool should work");
    
}, function shouldBePossibleToEncapsulateObjectWithReserved$typesProperty() {
    function Custom (val, $types){
        this.val = val;
        this.$types = $types;
    }
    var typeson = new Typeson().register({
        Custom: [
            x => x instanceof Custom,
            c => ({val: c.val, $types: c.$types}),
            o => new Custom(o.val, o.$types)
        ]
    });
    var input = new Custom("bar", "foo");
    
    var tson = typeson.stringify(input);
    console.log(tson);
    var x = typeson.parse(tson);
    assert (x instanceof Custom, "Should get a Custom back");
    assert (x.val === "bar", "Should have correct val value");
    assert (x.$types === 'foo', "Should have correct $types value");
}, function shouldLeaveLeftOutType() {
    // Uint8Buffer is not registered. 
}, function shouldResolveCyclicsInEncapsulatedObjects() {
    var buf = new ArrayBuffer(16); 
    var data = {
        buf: buf,
        bar: {
            data: new DataView(buf, 8, 8)
        }
    };
    var tson = typeson.stringify(data, null, 2);
    console.log(tson);
    var back = typeson.parse(tson);
    assert (back.buf === back.bar.data.buffer, "The buffers point to same object");    
}, function shouldSupportRegisteringAClassWithoutReplacerOrReviver() {
    function MyClass() {}
    var TSON = new Typeson().register({MyClass: MyClass});
    var x = new MyClass();
    x.hello = "world";
    var tson = TSON.stringify(x);
    console.log(tson);
    var back = TSON.parse(tson);
    assert (back instanceof MyClass, "Should revive to a MyClass instance.");
    assert (back.hello === "world", "Should have all properties there.");
}]);
