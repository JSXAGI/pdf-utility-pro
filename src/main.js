import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import * as docx from 'docx';
import JSZip from 'jszip';

// Workerの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;

// UI制御関数
function uiStart(msg) {
    const panel = document.getElementById('status-panel');
    if (panel) panel.style.display = 'block';
    document.getElementById('status-text').innerText = msg;
    document.getElementById('mainBar').value = 0;
}

function uiDone(msg, html) {
    document.getElementById('status-text').innerText = msg;
    document.getElementById('dl-area').innerHTML = html;
    document.getElementById('mainBar').value = 100;
}

// 結合処理
async function handleMerge(files) {
    uiStart("PDFを結合中...");
    try {
        const merged = await PDFDocument.create();
        for (const file of Array.from(files)) {
            const bytes = await file.arrayBuffer();
            const doc = await PDFDocument.load(bytes);
            const pages = await merged.copyPages(doc, doc.getPageIndices());
            pages.forEach(p => merged.addPage(p));
        }
        const saved = await merged.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        uiDone("結合完了！", `<a href="${URL.createObjectURL(blob)}" download="merged.pdf" class="btn">結合PDFを保存</a>`);
    } catch (err) { alert("結合エラー: " + err); }
}

// 匿名化処理
async function handleClean(file) {
    uiStart("メタデータ削除中...");
    try {
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes);
        doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setCreator(''); doc.setProducer('');
        const saved = await doc.save();
        const blob = new Blob([saved], { type: 'application/pdf' });
        uiDone("完了！", `<a href="${URL.createObjectURL(blob)}" download="cleaned.pdf" class="btn">保存</a>`);
    } catch (err) { alert("エラー: " + err); }
}

// イベント
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('toMerge')?.addEventListener('change', (e) => { if (e.target.files) handleMerge(e.target.files); });
    document.getElementById('toClean')?.addEventListener('change', (e) => { if (e.target.files?.[0]) handleClean(e.target.files[0]); });
});