import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeechPlayer,preferredVoice,entrySpeechText,speechLocale} from '../src/speech.mjs';
const voice=(lang,name='System',extra={})=>({lang,name,voiceURI:`${lang}-${name}`,localService:true,...extra});
function setup(voices=[]) {
  const events=new EventTarget(),document=new EventTarget();document.hidden=false;
  const engine=new EventTarget();engine.getVoices=()=>voices;engine.calls=[];engine.cancel=()=>{};engine.speak=u=>engine.calls.push(u);
  const env={speechSynthesis:engine,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},document,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events)};
  const player=createSpeechPlayer(()=>env),unsubscribe=player.subscribe(()=>{});
  return {player,engine,events,document,unsubscribe,setVoices:next=>{voices=next;engine.dispatchEvent(new Event('voiceschanged'));}};
}
test('日韓語音嚴格配對，優先 enhanced 聲音且允許使用者選擇，不退回英文',()=>{
  const voices=[voice('en-US'),voice('ja_JP'),voice('ja-JP','Enhanced'),voice('ko-KR')];
  assert.equal(preferredVoice(voices,'ja').name,'Enhanced');
  assert.equal(preferredVoice(voices,'ko').lang,'ko-KR');
  assert.equal(preferredVoice([voice('en-US')],'ja'),null);
  assert.equal(preferredVoice(voices,'ja',voices[1].voiceURI),voices[1]);
  assert.equal(speechLocale('ko'),'ko-KR');
});
test('朗讀使用詞庫假名或韓文原文，不使用中文或朋友記音',()=>{
  assert.equal(entrySpeechText({language:'ja',text:'傘',reading:'かさ',personal_mnemonic:'卡撒'}),'かさ');
  assert.equal(entrySpeechText({language:'ko',text:'우유',reading:null,personal_mnemonic:'嗚呦'}),'우유');
  assert.equal(entrySpeechText({language:'ko',text:'牛奶',reading:null}),'');
  assert.equal(entrySpeechText({language:'ja',text:'sushi',reading:null}),'');
});
test('聲音延後載入，沒有自動播放；一次只讀一段，過期事件不會干擾下一段',()=>{
  const s=setup();
  try {
    assert.equal(s.engine.calls.length,0);s.player.play('a','かさ','ja');assert.equal(s.player.getSnapshot().status,'error');
    s.setVoices([voice('ja-JP'),voice('ko-KR')]);s.player.play('a','かさ','ja');
    const old=s.engine.calls[0];assert.equal(old.text,'かさ');assert.equal(old.lang,'ja-JP');assert.equal(old.rate,1);
    old.onstart();assert.equal(s.player.getSnapshot().status,'speaking');
    s.player.play('b','우유','ko','',.8);const current=s.engine.calls[1];assert.equal(current.lang,'ko-KR');assert.equal(current.rate,.8);
    old.onerror();assert.equal(s.player.getSnapshot().owner,'b');
    s.player.stop('a');assert.equal(s.player.getSnapshot().owner,'b');
    current.onstart();current.onend();assert.equal(s.player.getSnapshot().owner,null);
  }finally{s.unsubscribe();}
});
test('換頁、背景、卸載停止朗讀；一個控制項卸載不移除其他控制項的換頁保護',()=>{
  const s=setup([voice('ja-JP')]);const unsubscribe2=s.player.subscribe(()=>{});s.unsubscribe();
  try {
    s.player.play('a','あ','ja');s.events.dispatchEvent(new Event('hashchange'));assert.equal(s.player.getSnapshot().owner,null);
    s.player.play('b','い','ja');s.document.hidden=true;s.document.dispatchEvent(new Event('visibilitychange'));assert.equal(s.player.getSnapshot().owner,null);
    s.player.play('c','う','ja');s.engine.calls.at(-1).onerror();assert.equal(s.player.getSnapshot().status,'error');
  }finally{unsubscribe2();}
  assert.equal(s.player.getSnapshot().owner,null);
});
test('不支援 Speech API 的環境可安全載入',()=>{
  const player=createSpeechPlayer(()=>null),unsubscribe=player.subscribe(()=>{});
  assert.equal(player.getSnapshot().supported,false);player.play('a','あ','ja');assert.equal(player.getSnapshot().status,'error');unsubscribe();
});
