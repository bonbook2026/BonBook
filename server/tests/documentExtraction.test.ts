import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
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
});
