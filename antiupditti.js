const djs = require('discord.js');
const needle = require('needle');
const client = new djs.Client();
const config = require('./config.json');

const url = "https://www.abitti.fi/fi/paivitykset/";
const changelog = "https://www.abitti.fi/fi/paivitykset/parannukset/digabios-palvelintikku-opiskelijan-tikku/";
const parse = require('node-html-parser').parse;
const fs = require('fs');
const Discord = require("discord.js");

const strikethruDiscord = "~~";

const codeDiscord = "`";

process
    .on('unhandledRejection', (reason, p) => {
        console.error(reason, 'Unhandled Rejection at Promise', p);
    })
    .on('uncaughtException', err => {
        console.error(err, 'Uncaught Exception thrown');
    });


function writeToCache(content, callback) {
    fs.writeFile('cache.json', content, callback);
}

function getCache(callback) {
    fs.readFile('cache.json', callback);
}

function findDifferenceAndMark(original, newString) {
    let markedContent = "";
    let difference = newString.split(" ");
    let newDiff = original.split(" ")
    difference.forEach((item, index) => {
        markedContent += item+" ";
        if (index <= newDiff.length-1) {
            let newWord = newDiff[index];
            console.log(item+" <- "+newWord);
            if (item !== newWord)
                markedContent+= strikethruDiscord+codeDiscord+newWord+codeDiscord+strikethruDiscord+" ";
        }
    });
    return markedContent;
}

function getChangelog() {
    return new Promise((resolve, reject) => {
        needle.get(changelog, (err, req) => {
            if (err) {
                reject(err);
                return;
            }
            let html = parse(req.body);
            let changelog = html.querySelector('div[class="msg-body"]').querySelector('ul');
            resolve(changelog.text.trim().split('\n'));
        });
    })
}

function check() {
    needle.get(url, function (err, req) {
        if (err) {
            console.error(err);
            setTimeout(check, 60*1000);
            return;
        }
        try {
            let html = parse(req.body);
            let versions = html.querySelectorAll('b[data-stringify-type="bold"]');
            let koe = versions[0].text;
            let ktp = versions[1].text;
            // Fetch API Version
            getCache((err, data) => {
                if (err) {
                    console.log("Unable to read cache: "+err);
                    console.log("skipping");
                    writeToCache(JSON.stringify({koe, ktp}), () => {
                        setTimeout(check, 60*1000);
                    });
                    return;
                }
                data = JSON.parse(data);
                if (data.koe !== koe || data.ktp !== ktp) {
                    let details = []
                    if (data.koe !== koe)
                        details.push({ name: 'Kokelastikku', value: findDifferenceAndMark(data.koe, koe) });
                    if (data.ktp !== ktp)
                        details.push({ name: 'Koetilapalvelin', value: findDifferenceAndMark(data.ktp, ktp) });
                    getChangelog().then(changelog => {
                        changelog.forEach(item => {
                            details.push({ name: '•', value: item});
                        })
                        const userEmbed = new Discord.MessageEmbed()
                            .setColor('#006ed2')
                            .setTitle('**Abitti** - Uusi päivitys')
                            .addFields(details);
                        global.channel.send(userEmbed);
                    }).catch(error => {
                        console.error(error);
                        details.push({ name: 'Muutosloki', value: '[https://www.abitti.fi/fi/tehty/parannukset/digabios-palvelintikku-opiskelijan-tikku/](https://www.abitti.fi/fi/tehty/parannukset/digabios-palvelintikku-opiskelijan-tikku/)'});
                        const userEmbed = new Discord.MessageEmbed()
                            .setColor('#006ed2')
                            .setTitle('**Abitti** - Uusi päivitys')
                            .addFields(details);
                        global.channel.send(userEmbed);
                    })
                }
                writeToCache(JSON.stringify({koe, ktp}), () => {
                    setTimeout(check, 60*1000);
                });
            })
        } catch (e) {
            console.error(e);
            setTimeout(check, 60*1000);
        }
    })
}

client.on('ready', () => {
    console.error("Ready!");
    client.channels.fetch(config.channel).then(channel => {
        console.log("Channel "+channel.name);
        global.channel = channel;
        check();
    })
});

client.login(config.token);
