const $ = (id) => document.getElementById(id);
const deviceSelect = $('deviceSelect'), gainSlider = $('gainSlider'), gainValue = $('gainValue');
const toggleButton = $('toggleButton'), status = $('status'), levelText = $('levelText'), meterFill = $('meterFill');
const spectrum = $('spectrumCanvas'), wave = $('waveCanvas');
let audioContext, analyser, gainNode, stream, active = false, anim;

function fit(canvas) { const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1; canvas.width = r.width*d; canvas.height = r.height*d; return canvas.getContext('2d'); }
function updateGain() { const gain = Number(gainSlider.value); gainValue.value = `${gain.toFixed(1)}×`; if(gainNode) gainNode.gain.setTargetAtTime(gain, audioContext.currentTime, .01); }
gainSlider.addEventListener('input', updateGain);

async function devices() {
  try { const list = await navigator.mediaDevices.enumerateDevices(); const mics = list.filter(d => d.kind === 'audioinput'); deviceSelect.innerHTML = mics.length ? mics.map((d,i)=>`<option value="${d.deviceId}">${d.label || `麥克風 ${i+1}`}</option>`).join('') : '<option>找不到音訊輸入裝置</option>'; } catch { deviceSelect.innerHTML='<option>無法取得裝置清單</option>'; }
}
async function start() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('此瀏覽器不支援麥克風存取');
    stream = await navigator.mediaDevices.getUserMedia({audio:{deviceId: deviceSelect.value ? {exact:deviceSelect.value}:undefined, echoCancellation:false, noiseSuppression:false, autoGainControl:false},video:false});
    audioContext = new (window.AudioContext || window.webkitAudioContext)({sampleRate:48000});
    analyser = audioContext.createAnalyser(); analyser.fftSize=4096; analyser.smoothingTimeConstant=.76;
    gainNode = audioContext.createGain(); updateGain();
    audioContext.createMediaStreamSource(stream).connect(gainNode).connect(analyser);
    active=true; toggleButton.innerHTML='<span class="button-dot"></span>停止監測'; status.classList.add('active'); status.lastElementChild.textContent='正在監測';
    const rate=audioContext.sampleRate, max=Math.min(22000,rate/2); $('rangeText').textContent=`0 – ${(max/1000).toFixed(1)} kHz`; $('sampleText').textContent=`${(rate/1000).toFixed(1)} kHz sampling`; $('hardwareText').textContent=`硬體取樣率 ${rate.toLocaleString()} Hz｜可分析至 ${(max/1000).toFixed(1)} kHz`;
    await devices(); draw();
  } catch(err) { status.lastElementChild.textContent='無法使用麥克風'; $('hardwareText').textContent=err.message; }
}
function stop() { active=false; cancelAnimationFrame(anim); stream?.getTracks().forEach(t=>t.stop()); audioContext?.close(); toggleButton.innerHTML='<span class="button-dot"></span>開始監測'; status.classList.remove('active'); status.lastElementChild.textContent='等待麥克風'; levelText.innerHTML='−∞ <em>dB</em>'; meterFill.style.width='0'; }
toggleButton.addEventListener('click',()=>active?stop():start()); deviceSelect.addEventListener('change',()=>{if(active){stop();start();}}); navigator.mediaDevices?.addEventListener?.('devicechange',devices); devices();

function grid(ctx,w,h,offset=35) { ctx.strokeStyle='#223147';ctx.lineWidth=1; for(let i=0;i<4;i++){const y=12+i*(h-38)/3;ctx.beginPath();ctx.moveTo(offset,y);ctx.lineTo(w,y);ctx.stroke();} for(let i=0;i<6;i++){const x=offset+i*(w-offset)/5;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h-28);ctx.stroke();} }
function draw() {
  if(!active) return; const sc=fit(spectrum), wc=fit(wave), sw=spectrum.width, sh=spectrum.height, ww=wave.width, wh=wave.height, d=devicePixelRatio||1;
  grid(sc,sw,sh,35*d); grid(wc,ww,wh,35*d); const freq=new Uint8Array(analyser.frequencyBinCount), time=new Uint8Array(analyser.fftSize); analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(time);
  const usable=Math.min(freq.length,Math.floor(22000/(audioContext.sampleRate/analyser.fftSize))); const left=35*d, base=sh-28*d; sc.beginPath(); for(let i=0;i<usable;i++){const x=left+i*(sw-left)/(usable-1), y=base-(freq[i]/255)*(base-7*d);i?sc.lineTo(x,y):sc.moveTo(x,y)} sc.lineTo(sw,base);sc.lineTo(left,base);sc.closePath();const fill=sc.createLinearGradient(0,0,0,base);fill.addColorStop(0,'rgba(66,232,224,.55)');fill.addColorStop(1,'rgba(66,232,224,.02)');sc.fillStyle=fill;sc.fill(); sc.beginPath(); for(let i=0;i<usable;i++){const x=left+i*(sw-left)/(usable-1),y=base-(freq[i]/255)*(base-7*d);i?sc.lineTo(x,y):sc.moveTo(x,y)}sc.strokeStyle='#42e8e0';sc.lineWidth=1.5*d;sc.stroke();
  wc.beginPath(); for(let i=0;i<time.length;i++){const x=left+i*(ww-left)/(time.length-1),y=(time[i]/255)*(wh-28*d);i?wc.lineTo(x,y):wc.moveTo(x,y)}wc.strokeStyle='#5895ff';wc.lineWidth=1.5*d;wc.stroke(); let sq=0; for(const v of time){const n=(v-128)/128;sq+=n*n} const rms=Math.sqrt(sq/time.length), db=Math.max(-90,20*Math.log10(rms)); levelText.innerHTML=`${db.toFixed(1)} <em>dB</em>`;meterFill.style.width=`${Math.max(0,Math.min(100,(db+60)*1.66))}%`; anim=requestAnimationFrame(draw);
}