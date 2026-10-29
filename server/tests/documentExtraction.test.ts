import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
import {execFileSync} from 'child_process';
import {extractDocument,paginateText,needsOcr,cleanText,ImportSource} from '../src/services/documentExtraction';
describe('Document extraction',()=>{
  let directory:string;
  beforeAll(async()=>{directory=await fs.mkdtemp(path.join(os.tmpdir(),'bonbook-import-test-'));});
  afterAll(async()=>{for(const name of await fs.readdir(directory))await fs.unlink(path.join(directory,name));await fs.rmdir(directory);});
  const extract=async(filename:string,format:string)=>{const pages:any[]=[];let total=0;const source:ImportSource={id:'fixture-source',filename,name:filename,format,mimeType:'text/plain'};await extractDocument(source,directory,'text',async count=>{total=count;},async page=>{pages.push(page);},async()=>false);return {pages,total};};
  it('splits large text at readable boundaries without losing its content',async()=>{
    const text=Array.from({length:40},(_,i)=>`بخش ${i+1}\nاین یک متن فارسی برای مطالعه و یادگیری است. `.repeat(4)).join('\n\n');
    await fs.writeFile(path.join(directory,'book.txt'),text);const {pages,total}=await extract('book.txt','txt');expect(total).toBeGreaterThan(2);expect(pages[0].sourceAssetId).toBe('fixture-source');expect(pages.every(p=>p.content.length<=40000)).toBe(true);expect(pages.map(p=>p.content).join(' ').replace(/\s/g,'')).toBe(cleanText(text).replace(/\s/g,''));
  });
  it('reads real DOCX XML as plain Persian text',async()=>{
    const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>عنوان کتاب فارسی</w:t></w:r></w:p><w:p><w:r><w:t>این متن از فایل ورد وارد شده است.</w:t></w:r></w:p></w:body></w:document>');await fs.writeFile(path.join(directory,'book.docx'),await zip.generateAsync({type:'nodebuffer'}));const {pages}=await extract('book.docx','docx');expect(pages[0].content).toContain('این متن از فایل ورد وارد شده است.');
  });
  it('follows EPUB reading order and does not import executable markup',async()=>{
    const zip=new JSZip();zip.file('META-INF/container.xml','<container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>');zip.file('OPS/package.opf','<package><manifest><item id="first" href="first.xhtml"/><item id="second" href="second.xhtml"/></manifest><spine><itemref idref="first"/><itemref idref="second"/></spine></package>');zip.file('OPS/first.xhtml','<html><body><h1>فصل اول</h1><p>متن اول</p><script>malicious()</script></body></html>');zip.file('OPS/second.xhtml','<html><body><p>فصل دوم</p></body></html>');await fs.writeFile(path.join(directory,'book.epub'),await zip.generateAsync({type:'nodebuffer'}));const {pages}=await extract('book.epub','epub');expect(pages[0].content.indexOf('فصل اول')).toBeLessThan(pages[0].content.indexOf('فصل دوم'));expect(pages[0].content).not.toContain('malicious');
  });
  it('detects a corrupt Persian text layer and preserves ordinary text',()=>{
    expect(needsOcr('این یک متن فارسی خوانا برای کتاب است. '.repeat(20))).toBe(false);expect(needsOcr('انسیییییان'.repeat(30))).toBe(true);expect(needsOcr('')).toBe(true);expect(paginateText('')).toHaveLength(0);
  });
  it('imports original PDF page references without OCR or extracting text',async()=>{
    const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] >>'];
    let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    await fs.writeFile(path.join(directory,'image-only.pdf'),pdf);
    // PDF.js is native ESM. Exercise its real loader outside Vitest's VM sandbox.
    const script=`const {extractDocument}=require(${JSON.stringify(path.resolve(__dirname,'../src/services/documentExtraction.ts'))});(async()=>{const pages=[];let count=0;await extractDocument({id:'original-pdf',filename:'image-only.pdf',name:'image-only.pdf',format:'pdf',mimeType:'application/pdf'},${JSON.stringify(directory)},'images',async total=>{count=total;},async page=>{pages.push(page);},async()=>false);console.log(JSON.stringify({count,pages}));})().catch(error=>{console.error(error);process.exitCode=1;});`;
    const output=execFileSync(process.execPath,['-r',require.resolve('ts-node/register/transpile-only'),'-e',script],{encoding:'utf8',env:{...process.env,TS_NODE_PROJECT:path.resolve(__dirname,'../tsconfig.json')},timeout:20000});
    const result=JSON.parse(output.trim().split('\n').at(-1)!);
    expect(result.count).toBe(2);expect(result.pages.map((p:any)=>[p.number,p.content,p.sourceAssetId,p.sourcePageNumber])).toEqual([[1,'','original-pdf',1],[2,'','original-pdf',2]]);
    const images:any[]=[];await extractDocument({id:'scan',filename:'not-even-decoded.png',name:'scan.png',format:'png',mimeType:'image/png'},directory,'images',async()=>{},async page=>{images.push(page);},async()=>false);expect(images[0].content).toBe('');expect(images[0].sourceAssetId).toBe('scan');
  });
});
