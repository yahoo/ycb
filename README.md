# Yahoo! Configuration Bundle

[![Build Status](https://secure.travis-ci.org/yahoo/ycb.png?branch=master)](http://travis-ci.org/yahoo/ycb)

YCB is a multi-dimensional configuration library that builds bundles from resource files describing a variety of values. The library allows applications to configure themselves based on multiple dimensions describing locations, languages, environments, etc.

More info on the [wiki](https://github.com/yahoo/ycb/wiki).

Examples are provided in the [this directory](https://github.com/yahoo/ycb/tree/master/tests).

### Install

`npm install ycb --save`

### Usage
```
var Ycb = require('ycb'),
    dimensions = [
        {
            "dimensions": [
                {
                    "environment": {
                        "dev": null,
                        "prod": null
                    }
                }
            ]
        }
    ],
    config = [
        {
            "settings": ["master"],
            "host": "example.com"
        },
        {
            "settings": ["environment:dev"],
            "host": "dev.example.com"
        }
    ],
    context = { environment: 'dev' },
    ycb = new Ycb.Ycb(dimensions.concat(config)),
    config = ycb.read(context);

console.log(config.host); // dev.example.com
```


### License
BSD see LICENSE.txt
