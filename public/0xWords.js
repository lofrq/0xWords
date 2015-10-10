!function( window, document ) {
    var
        sentRe   = /(?:\s)*([^\.!?]+)/gmi,
        wordRe   = /(?:\s)*([\w]{2,})/gi,
        oXre     = /^[abcdef]+$/gi,

        notes    = '',

        textarea = document.getElementById('text'),
        form     = document.getElementById('form'),

        getSentences = function( string ) {
            return string.match(sentRe) || [];
        },

        getWords = function( string ) {
            return string.match(wordRe) || [];
        },

        testWord = function( word ) {
            return oXre.test(word.trim());
        },

        showWord = function( word ) {
            var
                el = document.createElement('p'),
                t = document.createTextNode(word);

            el.appendChild(t);
            document.body.appendChild(el);
        },

        player = {
            barDuration : 8,
            timeline : 0,
            velocity : 127,
            key : {
                C : 1,
                D : 1,
                F : 1,
                G : 1
            },
            tempAlts : {},
            play : function( noteString, duration, moveTime ) {
                var
                    noteInt = this.calcNote(noteString);

                MIDI.noteOn(0, noteInt, this.velocity, this.timeline);
                MIDI.noteOff(0, noteInt, this.velocity, this.timeline + this.barDuration * duration);

                if ( typeof moveTime !== 'undefined' && moveTime === true ) {
                    this.move(duration);
                }
            },

            move : function( duration ) {
                this.timeline += this.barDuration * duration;

                if ( this.isEndOfBar() ) {
                    this.tempAlts = {};
                }
            },

            calcNote : function( noteString ) {
                var
                    note           = noteString[0],
                    noteWithOctave = noteString.substring(0,2),
                    // есть ли временные знаки альтерации при ноте
                    altering       = this.getAltering(noteString);

                // установим временные диезы, бемоли, бекары
                if ( altering ) {
                    this.setTempAltering(noteWithOctave, altering);
                }

                // если временных альтераций нет - возвращаем номер ноты в MIDI + сдвиг по тональности
                if ( this.tempAlts[noteWithOctave] !== undefined ) {
                    return MIDI.keyToNote[noteWithOctave] + this.tempAlts[noteWithOctave];
                }

                // если временные альтерации есть - возвращаем номер ноты в MIDI + сдвиг по временной альтерации
                // тональность здесь не учавствует
                return MIDI.keyToNote[noteWithOctave] + (( this.key[note] !== undefined ) ? this.key[note] : 0);
            },

            isEndOfBar : function() {
                return !!(this.timeline % this.barDuration === 0);
            },

            // получить знак альтерации при ноте или false
            getAltering : function( noteString ) {
                var
                    altering = noteString[2];

                return altering !== undefined ? altering : false;
            },

            setTempAltering : function( noteWithOctave, altering ) {
                switch ( altering ) {
                    // знак бемоля при ноте временно понижает ноту на 1 полутон и так далее
                    case 'b':
                        this.tempAlts[noteWithOctave] = -1;
                        break;
                    // бекар обозначил как "%"
                    case '%':
                        this.tempAlts[noteWithOctave] = 0;
                        break;
                    case '#':
                        this.tempAlts[noteWithOctave] = 1;
                        break;
                }
            }
        },

        play = function() {
            var
                defaultLen = 1/16,
                defaultKey = '4',
                newLen     = 0,
                script     = '',

                currNote,
                nextNote,
                savedNote,
                i;

            for ( i = 0; i < notes.length; ) {
                newLen = 0;

                currNote = notes[i];
                nextNote = notes[i + 1];

                // Если это нота
                if ( /[abcdef]/ig.test(currNote) ) {
                    // Следующий символ так же нота
                    if ( /[abcdef]/ig.test(nextNote) ) {
                        // console.info('Simple note...play', currNote.toUpperCase() + defaultKey, defaultLen);
                        // script += 'player.play("' + (currNote.toUpperCase() + defaultKey) + '", ' + defaultLen + ', true);'
                        player.play(currNote.toUpperCase() + defaultKey, defaultLen, true);
                    } else {
                        i++;
                        while ( !/[abcdef]/ig.test(notes[i]) ) {
                            i++;
                            newLen++;
                        }

                        i--;

                        newLen = newLen/10;

                        newLen = ( defaultLen * newLen > 0.5 ) ? 0.5 : defaultLen * newLen;

                        // console.log('Long note. Play', currNote.toUpperCase() + defaultKey, newLen);
                        // script += 'player.play("' + (currNote.toUpperCase() + defaultKey) + '", ' + newLen + ', true);'
                        player.play(currNote.toUpperCase() + defaultKey, newLen, true);
                    }
                } else {
                    // console.info('%s is not a note. Test res: %s', currNote, /[abcdef]/ig.test(currNote));
                }

                i++;
            }

            // showWord(script);
            // eval(script);
        },

        start = function() {
            var
                string  = textarea.value,
                sent    = getSentences(string),
                words   = [],
                word,
                i, j;

            notes = '';

            console.log('start');

            for ( i = 0; i < sent.length; i++ ) {
                words = getWords(sent[i]);

                for ( j = 0; j < words.length; j++ ) {
                    word = words[j];

                    if ( testWord(word) ) {
                        notes += word;
                    } else {
                        notes += word.replace(/\w+/, '_');
                    }
                }
            }

            showWord(notes);
            play();
        };

    /**
     * BIBLE http://www.ccel.org/ccel/bible/kjv.txt
     * TRAINSPOTTING http://vk.com/doc-29626_199662082?dl=1393ea5a00c5eb292d
     */

    MIDI.loadPlugin({
        soundfontUrl: './soundfont/',
        instrument: 'acoustic_grand_piano',
        onprogress: function( state, progress ) {
            console.log(state, progress);
        },
        onsuccess: function() {
            form.addEventListener('submit', start);
        }
    });
}(
    this,
    this.document
);