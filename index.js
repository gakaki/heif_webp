"use strict";

// import {nunjucks} from 'nunjucks'
// import {shell} from 'shelljs'
const nunjucks    = require('nunjucks')
const shell       = require('shelljs')
const fs          = require('fs')
const glob        = require('glob');
const path        = require('path');
const filesize    = require('file-size');

// const fastGlob    = require('fast-glob');
// async function list_files( pattern ){
//     let res = await fastGlob(pattern);
//     console.log(res);
// }
// list_files(pattern)



class FileNeedCompress {
    constructor( file_path  ){
        this.file_path              = file_path
        this.file_name_no_ext       = path.basename(this.file_path,'.jpg')
        this.file_name_source       = `pics/${this.file_name_no_ext}.jpg`
        this.file_name_cfg_dist     = `dist/${this.file_name_no_ext}.cfg`
        this.file_name_dist_prefix  = `dist/${this.file_name_no_ext}`

        this.file_name_dist_webp    = `dist/${this.file_name_no_ext}.webp`
        this.file_name_dist_heic    = `dist/${this.file_name_no_ext}.heic`
    }
    getFileSize(filePath) {
        var stats = fs.statSync(filePath);
        // console.log('stats', stats);
        var size = stats["size"];
        // convert it to humanly readable format.
        var i = Math.floor( Math.log(size) / Math.log(1024) );
        return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
    }
}



class MultiFileCompress{

    constructor(){

    }

    list_files( pattern     = 'pics/*.jpg' ){
        return new Promise(function(resolve, reject){
            glob(pattern, {nodir: true}, function (err, files) {
                if(err){
                    console.log(err);
                    reject(new Error("message" , err));
                }
                else
                {
                    console.log(files);
                    resolve(files)
                }
            })
        });
    }

    async  start_process(){
        try{
            // console.log("1")
            this.files = await this.list_files()
            // console.log("2")
        }catch(e){
            console.log(e)
        }
        try{
            let res_list = []
            let res_objs = []
            for ( let f of this.files ){
                var p = new Compress(f)
                res_list.push(p.exec())

            }

            shell.echo("-----------============Final Result===========-------------")
            for ( let r of res_list ){
                shell.echo(r)
            }
        }catch(e){
            console.log(e)
        }


    }

}



class Compress{
    constructor( file_path ){

        this.file               = new FileNeedCompress(file_path)

        this.template_rm = `
    rm -f {{ file_name_dist }}.265;
    rm -f {{ file_name_dist }}.webp;
    rm -f {{ file_name_dist }}.heic;
    rm -f {{ file_name_dist }}.cfg;
`;

        this.template_heic_cfg = `{
		"general":
		{
		"output":
		{
			"file_path" : "{{ file_name_dist }}.heic"
		},
		"brands":
		{
			"major" : "mif1",
			"other" : ["mif1", "heic", "hevc"]
		},
		"prim_refr" : "1",
		"prim_indx" : "1"
		},
		"content":
		[
		{
			"master":
			{
				"uniq_bsid" : "1",
				"file_path" : "{{ file_name_dist }}.265",
				"hdlr_type" : "pict",
				"code_type" : "hvc1",
				"encp_type" : "meta",
				"disp_xdim" : "1440",
				"disp_ydim" : "960",
				"disp_rate" : "1"
			}
		}
		]
}
`;

        this.template_compress_shell = `
ffmpeg -i {{ file_name_source }} -crf 12 -preset slower -pix_fmt yuv420p \
  -f hevc {{ file_name_dist }}.265;

# ffmpeg -i {{ file_name_source }} -vf scale=320:240 -crf 28 -preset slower \
#   -pix_fmt yuv420p -f hevc {{ file_name_dist }}.thumb.265;

./writerapp {{ file_name_cfg_dist }};

cwebp -pass 2 -mt -progress -m 6 -q 90 {{ file_name_source }} -o {{ file_name_dist }}.webp;
`;

        this.template_clear_shell = `
            rm -f {{ file_name_dist }}.265;
            rm -f {{ file_name_dist }}.cfg;
        `
    }

    run_template_str( template_str ){

        let template        = nunjucks.compile(template_str)
        let replace_obj     = {
            file_name_dist      : this.file.file_name_dist_prefix,
            file_name_source    : this.file.file_name_source,
            file_name_cfg_dist  : this.file.file_name_cfg_dist
        }
        let res             = template.render(replace_obj)
        return res
    }

    run_shell_exec(shell_str , err = 'Error: rm webp and heic and cfg failed'){
        if (shell.exec(shell_str).code !== 0) {
            shell.echo(err);
            shell.exit(1);
        }else{
            console.log(shell_str)
        }
    }

    exec(){

        //1 run rm shell
        let shell_rm            = this.run_template_str( this.template_rm )
        this.run_shell_exec(shell_rm , 'Error: rm webp and heic and cfg failed')

        //2 run generate heic cfg
        let shell_heic_cfg      = this.run_template_str( this.template_heic_cfg  )
        fs.writeFileSync(this.file.file_name_cfg_dist, shell_heic_cfg, 'utf8');

        //3 run commpress shell
        let shell_compress      = this.run_template_str( this.template_compress_shell )
        this.run_shell_exec(shell_compress , 'Error: run compress process error')

        //4 run clear shell
        let shell_clear         = this.run_template_str( this.template_clear_shell )
        this.run_shell_exec(shell_clear , 'Error: run clear process error')


        let res                 = ` 
            OK! Success >> 
            ${this.file.file_name_source},      ${this.file.getFileSize(this.file.file_name_source)},
            ${this.file.file_name_dist_heic},   ${this.file.getFileSize(this.file.file_name_dist_heic)}
            ${this.file.file_name_dist_webp},   ${this.file.getFileSize(this.file.file_name_dist_webp)}
        `
        shell.echo(res)

        return res
    }
}

let m = new MultiFileCompress()
m.start_process()


// Compress.multiFileCompress()



