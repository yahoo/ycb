# Yahoo! Configuration Bundle

[![Build Status](https://secure.travis-ci.org/yahoo/ycb.png?branch=master)](http://travis-ci.org/yahoo/ycb)

YCB is a multi-dimensional configuration library that builds bundles from resource files describing a variety of values. The library allows applications to configure themselves based on multiple dimensions describing locations, languages, environments, etc.

More info on the [wiki](https://github.com/yahoo/ycb/wiki).

Examples are provided in the [this directory](https://github.com/yahoo/ycb/tree/master/tests).

### Install

`npm install ycb --save`

### Example

`dimensions.json` file:
```json
[
    {
        "dimensions": [
            {
                "environment": {
                    "testing": null,
                        "prod": null
                }
            },
            {
                "device": {
                    "desktop": null,
                    "mobile": {
                        "table": null,
                        "smartphone": null
                    }
                }
            }
        ]
    }
]
```

`application.json` file:
```json
[
    {
        "settings": [ "master" ],
            "appPort": 8666
    },
    {
        "settings": [ "environment:prod" ],
        "appPort": 80
    },
    {
        "settings": [ "device:desktop" ],
        "appPort": 8080
    },
    {
        "settings": [ "environment:prod", "device:smartphone" ],
        "appPort": 8888
    }
]
```

`app.js` file:
```javascript
var Ycb = require('ycb').Ycb;
var dimensions = require('./dimensions');
var application = require('./application');

var data = dimensions.concat(config);

var ycb = new Ycb(data, {});

var config;

// read "master"
config = ycb.read({});

// read "environment:prod"
config = ycb.read({environment: 'prod'});

// read "device:desktop"
config = ycb.read({device: 'desktop'});

//  read "environment:prod", "device:desktop"
config = ycb.read({environment: 'prod', device: 'smartphone'});
```

### License
BSD see LICENSE.txt
