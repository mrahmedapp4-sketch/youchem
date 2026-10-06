export interface ImportedExamQuestion {
  question: string;
  correct_answer: string;
  image: string;
  options: string[];
}

export interface ExamViewImportResult {
  questions: ImportedExamQuestion[];
  skippedUnsupported: number;
  missingImages: string[];
}

function cleanText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, select, textarea, input, .spacer').forEach(node => node.remove());
  clone.querySelectorAll('br').forEach(node => node.replaceWith(clone.ownerDocument!.createTextNode(' ')));
  clone.querySelectorAll('img').forEach(node => {
    const image = node as HTMLImageElement;
    const name = image.getAttribute('alt') || image.getAttribute('src') || 'صورة';
    node.replaceWith(clone.ownerDocument!.createTextNode(`[صورة غير مرفقة: ${name}]`));
  });
  return (clone.textContent || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseExamViewHtml(html: string): ExamViewImportResult {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const scripts = Array.from(document.querySelectorAll('script')).map(script => script.textContent || '').join('\n');
  const questionTypes = scripts.match(/\bqtypeMap\s*=\s*['"]([^'"]+)['"]/i)?.[1] || '';
  const encodedAnswers = new Map<number, string>();
  const answerPattern = /\bansMap\[(\d+)\]\s*=\s*['"]([^'"]*)['"]/gi;
  for (const match of scripts.matchAll(answerPattern)) {
    encodedAnswers.set(Number(match[1]), match[2]);
  }

  const controls = Array.from(document.querySelectorAll<HTMLSelectElement>('select[name^="MC:"]'));
  const questions: ImportedExamQuestion[] = [];
  const missingImages = new Set<string>();
  let skippedUnsupported = document.querySelectorAll('textarea[name^="ES:"]').length;

  for (const control of controls) {
    const indexMatch = control.name.match(/:(\d+)$/);
    const questionIndex = indexMatch ? Number(indexMatch[1]) - 1 : -1;
    const row = control.closest('tr');
    const cells = row ? Array.from(row.children).filter((child): child is HTMLTableCellElement =>
      child instanceof HTMLTableCellElement,
    ) : [];
    const contentCell = cells[2];
    if (questionIndex < 0 || !contentCell) {
      skippedUnsupported++;
      continue;
    }

    const prompt = Array.from(contentCell.children).find(child => child.classList.contains('default'));
    const question = prompt ? cleanText(prompt) : '';
    const optionTable = contentCell.querySelector('table');
    const optionRows = optionTable ? Array.from(optionTable.querySelectorAll('tr')) : [];
    const options = ['', '', '', ''];
    for (const optionRow of optionRows) {
      const label = optionRow.querySelector('.choice')?.textContent?.trim().toUpperCase();
      const optionIndex = ['A', 'B', 'C', 'D'].indexOf(label || '');
      const optionTextCell = optionRow.querySelectorAll('td').item(1);
      if (optionIndex >= 0 && optionTextCell) options[optionIndex] = cleanText(optionTextCell);
    }

    const encoded = encodedAnswers.get(questionIndex);
    const answerType = questionTypes.charAt(questionIndex);
    let correctAnswer = '';
    if (encoded && answerType && answerType !== 'B') {
      const key = (questionIndex % 31) + 1;
      let decoded = '';
      for (let i = 0; i < encoded.length; i += 2) {
        const byte = Number.parseInt(encoded.slice(i, i + 2), 16);
        if (!Number.isNaN(byte)) decoded += String.fromCharCode(byte ^ key);
      }
      correctAnswer = decoded.trim().toUpperCase();
    }

    if (!question || options.some(option => !option) || !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      skippedUnsupported++;
      continue;
    }

    for (const image of prompt?.querySelectorAll('img') || []) {
      missingImages.add(image.getAttribute('alt') || image.getAttribute('src') || 'صورة');
    }
    questions.push({ question, correct_answer: correctAnswer, image: '', options });
  }

  return { questions, skippedUnsupported, missingImages: Array.from(missingImages) };
}
