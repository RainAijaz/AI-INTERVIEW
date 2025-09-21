/**
 * reportGenerator.js (Narrative Layout Version)
 * --------------------------------------------------------------------------
 * Purpose:
 * - Generates a detailed, single-column report with a clear narrative flow.
 * - Groups visual data and textual analysis into logical, beautifully styled sections.
 * - Uses encouraging, professional labels for all feedback points.
 */

const emotionMap = {
  joy: "Confident",
  love: "Confident",
  surprise: "Engaged",
  sadness: "Hesitant",
  fear: "Cautious",
  anger: "Assertive",
};

/**
 * Main function to generate the full interview report.
 */
function generateReport() {
  const reportContent = document.getElementById("report-content");
  reportContent.innerHTML = "";

  if (interviewData.length === 0) {
    reportContent.innerHTML = "<p>No answers were recorded. Practice again to see your report!</p>";
    return;
  }

  interviewData.forEach((data, index) => {
    const reportItem = createReportItem(index, data);
    reportContent.appendChild(reportItem);

    // Render all charts after the HTML is in the DOM
    if (typeof renderCharts === "function") {
      // Renders posture & facial emotion charts
      renderCharts(reportItem, data, index);
    }
    renderTextualEmotionChart(`textualEmotionChart_${index}`, data.textualEmotionAnalysis?.data);
  });
}

/**
 * Creates the main container and structure for a single report item.
 */
function createReportItem(index, data) {
  const reportItem = document.createElement("div");
  reportItem.id = `report-item-${index}`;
  reportItem.className = "report-item card";

  // Build the report with the new narrative structure
  reportItem.innerHTML = `
    <h3>Question ${index + 1}: ${data.question}</h3>
    <p class="user-answer"><strong>Your Answer:</strong> "${data.transcription}"</p>
    
    ${createDemeanorSectionHtml(data, index)}
    ${createContentSectionHtml(data, index)}
  `;

  return reportItem;
}

/**
 * Creates the HTML for the "Delivery & Demeanor" section, including non-verbal charts.
 */
function createDemeanorSectionHtml(data, index) {
  if (!data.holisticFeedback?.insight) return "";

  const postureChartHtml = data.postureAnalysis?.data
    ? `<div class="chart-container">
         <h4>Posture Breakdown</h4>
         <canvas id="postureChart_${index}"></canvas>
       </div>`
    : "";
  const emotionChartHtml = data.emotionAnalysis?.data
    ? `<div class="chart-container">
         <h4>Facial Emotion</h4>
         <canvas id="emotionChart_${index}"></canvas>
       </div>`
    : "";

  return `
    <div class="feedback-section-wrapper">
      <h4><span class="icon">🤖</span> Delivery & Demeanor</h4>
      <p>${data.holisticFeedback.insight}</p>
      <div class="charts-wrapper">
        ${postureChartHtml}
        ${emotionChartHtml}
      </div>
      <div class="feedback-points">
        <div><strong>⭐ A Key Strength:</strong> ${data.holisticFeedback.strength}</div>
        <div><strong>💡 An Area for Growth:</strong> ${data.holisticFeedback.improvement_tip}</div>
      </div>
    </div>
  `;
}

/**
 * Creates the HTML for the "Content & Structure" section, with the vocal tone chart inside.
 */
function createContentSectionHtml(data, index) {
  if (!data.evaluation) return "";

  const { ratings, sentimentTone, answerStrength, howToMakeItBetter, suggestedBetterAnswer } = data.evaluation;
  const starsHtml = (rating) => "⭐".repeat(rating || 0) + "☆".repeat(5 - (rating || 0));

  const ratingsHtml = Object.entries(ratings || {})
    .map(([key, value]) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      return `
        <div class="rating-item">
          <div class="rating-label"><strong>${label}:</strong><span class="stars">${starsHtml(value.score)}</span></div>
          <div class="rating-justification"><em>${value.justification}</em></div>
        </div>`;
    })
    .join("");

  const howToImproveHtml =
    howToMakeItBetter?.length > 0
      ? `<h5>Refining Your Content</h5>
       <ul>${howToMakeItBetter.map((tip) => `<li>${tip}</li>`).join("")}</ul>`
      : "";

  const suggestedAnswerHtml = suggestedBetterAnswer
    ? `<h5>Example of a Stronger Answer</h5>
       <details><summary class="collapsible-header">View example</summary><div class="collapsible-content"><p>${suggestedBetterAnswer}</p></div></details>`
    : "";

  return `
    <div class="feedback-section-wrapper">
      <h4><span class="icon">🗣️</span> Content & Structure</h4>
      <div class="ratings-grid">${ratingsHtml}</div>
      <hr>
      <p><strong>Answer Strength:</strong> ${answerStrength}</p>
      <h3>Sentiment Tone Analysis</h3>
      <p>${sentimentTone}</p>
    <div class="chart-container textual-emotion-chart">
        <div class="dominant-emotion-label">
        <strong>Dominant Tone:</strong>
        <span class="highlight">${emotionMap[data.dominantEmotion] || data.dominantEmotion}</span>
     </div>
        <canvas id="textualEmotionChart_${index}"></canvas>
    </div>

      <hr>
      ${howToImproveHtml}
      ${suggestedAnswerHtml}
    </div>
  `;
}

/**
 * Renders the doughnut chart for textual emotion scores.
 */
function renderTextualEmotionChart(canvasId, data) {
  const canvasElement = document.getElementById(canvasId);
  if (!canvasElement || !data || Object.keys(data).length === 0) return;
  const ctx = canvasElement.getContext("2d");
  const significantEmotions = Object.entries(data).filter(([, score]) => score > 0.03);
  const mappedEmotions = significantEmotions.map(([key, value]) => {
    const mappedKey = emotionMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
    return [mappedKey, value];
  });
  const labels = mappedEmotions.map(([mappedKey]) => mappedKey);
  const scores = mappedEmotions.map(([, score]) => score);
  const backgroundColors = ["rgba(75, 192, 192, 0.8)", "rgba(54, 162, 235, 0.8)", "rgba(255, 206, 86, 0.8)", "rgba(153, 102, 255, 0.8)", "rgba(255, 99, 132, 0.8)", "rgba(255, 159, 64, 0.8)"];
  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Emotion Score",
          data: scores,
          backgroundColor: backgroundColors,
          borderColor: getComputedStyle(document.body).getPropertyValue("--surface-color") || "#ffffff",
          borderWidth: 3,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: {
            color: getComputedStyle(document.body).getPropertyValue("--text-color"),
            boxWidth: 20,
            padding: 15,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              let label = context.label || "";
              if (label) {
                label += ": ";
              }
              const value = context.raw;
              label += (value * 100).toFixed(1) + "%";
              return label;
            },
          },
        },
      },
    },
  });
}

document.getElementById("download-report-btn").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf;
  const reportElement = document.querySelector(".report-container");
  const reportControls = document.querySelector(".report-controls");

  if (reportControls) reportControls.style.display = "none";
  document.body.style.overflow = "visible";
  reportElement.classList.add("pdf-render-mode");

  const bgColor = getComputedStyle(document.body).getPropertyValue("--background") || "#ffffff";
  const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, backgroundColor: bgColor.trim() });

  if (reportControls) reportControls.style.display = "flex";
  document.body.style.overflow = "hidden";
  reportElement.classList.remove("pdf-render-mode");

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "pt", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }
  pdf.save("AI-Interview-Report.pdf");
});
