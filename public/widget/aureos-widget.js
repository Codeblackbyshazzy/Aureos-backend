/**
 * Aureos Embeddable Feedback Widget
 * A lightweight, customizable widget for collecting feedback and NPS surveys
 * Version: 1.0.0
 */

(function(window, document) {
  'use strict';

  // Widget configuration defaults
  const DEFAULT_CONFIG = {
    position: 'bottom-right',
    primaryColor: '#007bff',
    title: 'Feedback',
    buttonText: 'Feedback',
    autoOpen: false,
    theme: 'light', // 'light', 'dark', 'auto'
    allowClose: true,
    showPoweredBy: false,
    customClass: '',
    zIndex: 999999,
    backdrop: true,
    keyboard: true,
    focusTrap: true
  };

  // CSS styles for the widget
  const WIDGET_STYLES = `
    .aureos-widget-container {
      position: fixed;
      z-index: var(--aureos-z-index, 999999);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .aureos-widget-bottom-right { bottom: 20px; right: 20px; }
    .aureos-widget-bottom-left { bottom: 20px; left: 20px; }
    .aureos-widget-top-right { top: 20px; right: 20px; }
    .aureos-widget-top-left { top: 20px; left: 20px; }
    
    .aureos-widget-button {
      background-color: var(--aureos-primary-color, #007bff);
      color: white;
      border: none;
      border-radius: 25px;
      padding: 12px 20px;
      cursor: pointer;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .aureos-widget-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    .aureos-widget-button:active {
      transform: translateY(0);
    }
    
    .aureos-widget-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: calc(var(--aureos-z-index, 999999) + 1);
      animation: aureos-fade-in 0.3s ease;
    }
    
    .aureos-widget-modal.aureos-modal-open {
      display: flex;
    }
    
    .aureos-widget-modal-content {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      animation: aureos-slide-up 0.3s ease;
      position: relative;
    }
    
    .aureos-widget-header {
      padding: 20px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      justify-content: between;
      align-items: center;
    }
    
    .aureos-widget-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }
    
    .aureos-widget-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background-color 0.2s;
    }
    
    .aureos-widget-close:hover {
      background-color: #f5f5f5;
    }
    
    .aureos-widget-body {
      padding: 20px;
    }
    
    .aureos-widget-form-group {
      margin-bottom: 16px;
    }
    
    .aureos-widget-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    
    .aureos-widget-input,
    .aureos-widget-textarea,
    .aureos-widget-select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    
    .aureos-widget-input:focus,
    .aureos-widget-textarea:focus,
    .aureos-widget-select:focus {
      outline: none;
      border-color: var(--aureos-primary-color, #007bff);
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
    }
    
    .aureos-widget-textarea {
      resize: vertical;
      min-height: 100px;
    }
    
    .aureos-widget-button-primary {
      background-color: var(--aureos-primary-color, #007bff);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
      width: 100%;
    }
    
    .aureos-widget-button-primary:hover {
      background-color: #0056b3;
    }
    
    .aureos-widget-button-primary:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    
    .aureos-widget-success {
      text-align: center;
      padding: 40px 20px;
    }
    
    .aureos-widget-success-icon {
      font-size: 48px;
      color: #28a745;
      margin-bottom: 16px;
    }
    
    .aureos-widget-success-message {
      font-size: 16px;
      color: #333;
      margin-bottom: 20px;
    }
    
    /* NPS Survey Styles */
    .aureos-nps-container {
      text-align: center;
      padding: 20px 0;
    }
    
    .aureos-nps-question {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 20px;
      color: #333;
    }
    
    .aureos-nps-scale {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .aureos-nps-button {
      width: 40px;
      height: 40px;
      border: 2px solid #ddd;
      background: white;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      transition: all 0.2s;
      font-size: 14px;
    }
    
    .aureos-nps-button:hover {
      border-color: var(--aureos-primary-color, #007bff);
      background-color: rgba(0, 123, 255, 0.05);
    }
    
    .aureos-nps-button.selected {
      background-color: var(--aureos-primary-color, #007bff);
      border-color: var(--aureos-primary-color, #007bff);
      color: white;
    }
    
    .aureos-nps-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #666;
      margin-top: 8px;
    }
    
    /* Dark Theme */
    .aureos-widget-dark .aureos-widget-modal-content {
      background: #1a1a1a;
      color: #fff;
    }
    
    .aureos-widget-dark .aureos-widget-header {
      border-bottom-color: #333;
    }
    
    .aureos-widget-dark .aureos-widget-title {
      color: #fff;
    }
    
    .aureos-widget-dark .aureos-widget-close {
      color: #ccc;
    }
    
    .aureos-widget-dark .aureos-widget-close:hover {
      background-color: #333;
    }
    
    .aureos-widget-dark .aureos-widget-label {
      color: #fff;
    }
    
    .aureos-widget-dark .aureos-widget-input,
    .aureos-widget-dark .aureos-widget-textarea,
    .aureos-widget-dark .aureos-widget-select {
      background: #333;
      border-color: #555;
      color: #fff;
    }
    
    .aureos-widget-dark .aureos-widget-input:focus,
    .aureos-widget-dark .aureos-widget-textarea:focus,
    .aureos-widget-dark .aureos-widget-select:focus {
      border-color: var(--aureos-primary-color, #007bff);
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
    }
    
    .aureos-widget-dark .aureos-nps-button {
      background: #333;
      border-color: #555;
      color: #fff;
    }
    
    .aureos-widget-dark .aureos-nps-button:hover {
      border-color: var(--aureos-primary-color, #007bff);
      background-color: rgba(0, 123, 255, 0.1);
    }
    
    .aureos-widget-dark .aureos-nps-question {
      color: #fff;
    }
    
    .aureos-widget-dark .aureos-nps-labels {
      color: #ccc;
    }
    
    /* Mobile Responsive */
    @media (max-width: 480px) {
      .aureos-widget-container {
        bottom: 10px !important;
        left: 10px !important;
        right: 10px !important;
      }
      
      .aureos-widget-button {
        width: 100%;
        justify-content: center;
        border-radius: 8px;
      }
      
      .aureos-widget-modal-content {
        width: 95%;
        margin: 10px;
        max-height: 90vh;
      }
      
      .aureos-nps-scale {
        gap: 4px;
      }
      
      .aureos-nps-button {
        width: 32px;
        height: 32px;
        font-size: 12px;
      }
    }
    
    /* Animations */
    @keyframes aureos-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes aureos-slide-up {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Accessibility */
    .aureos-widget-button:focus,
    .aureos-widget-input:focus,
    .aureos-widget-textarea:focus,
    .aureos-widget-select:focus,
    .aureos-widget-close:focus,
    .aureos-nps-button:focus {
      outline: 2px solid var(--aureos-primary-color, #007bff);
      outline-offset: 2px;
    }
    
    /* High contrast mode support */
    @media (prefers-contrast: high) {
      .aureos-widget-button {
        border: 2px solid currentColor;
      }
      
      .aureos-widget-modal-content {
        border: 2px solid currentColor;
      }
    }
  `;

  // Main Widget Class
  class AureosWidget {
    constructor(config = {}) {
      this.config = { ...DEFAULT_CONFIG, ...config };
      this.isOpen = false;
      this.isLoading = false;
      this.currentSurvey = null;
      this.responses = new Map();
      
      this.init();
    }

    init() {
      // Inject styles
      this.injectStyles();
      
      // Create widget elements
      this.createWidgetElements();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Auto-open if configured
      if (this.config.autoOpen) {
        setTimeout(() => this.open(), 1000);
      }
      
      // Apply theme
      this.applyTheme();
    }

    injectStyles() {
      if (!document.getElementById('aureos-widget-styles')) {
        const style = document.createElement('style');
        style.id = 'aureos-widget-styles';
        style.textContent = WIDGET_STYLES;
        document.head.appendChild(style);
      }
    }

    createWidgetElements() {
      // Container
      this.container = document.createElement('div');
      this.container.className = `aureos-widget-container aureos-widget-${this.config.position} ${this.config.customClass}`;
      this.container.style.setProperty('--aureos-primary-color', this.config.primaryColor);
      this.container.style.setProperty('--aureos-z-index', this.config.zIndex);
      
      // Button
      this.button = document.createElement('button');
      this.button.className = 'aureos-widget-button';
      this.button.innerHTML = `
        <span>${this.config.buttonText}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      
      // Modal
      this.modal = document.createElement('div');
      this.modal.className = 'aureos-widget-modal';
      this.modal.innerHTML = `
        <div class="aureos-widget-modal-content">
          <div class="aureos-widget-header">
            <h3 class="aureos-widget-title">${this.config.title}</h3>
            ${this.config.allowClose ? '<button class="aureos-widget-close" aria-label="Close">&times;</button>' : ''}
          </div>
          <div class="aureos-widget-body">
            <div id="aureos-widget-content"></div>
          </div>
        </div>
      `;
      
      this.content = this.modal.querySelector('#aureos-widget-content');
      
      // Assemble
      this.container.appendChild(this.button);
      this.container.appendChild(this.modal);
      document.body.appendChild(this.container);
    }

    setupEventListeners() {
      // Button click
      this.button.addEventListener('click', () => this.toggle());
      
      // Modal close
      if (this.config.allowClose) {
        const closeBtn = this.modal.querySelector('.aureos-widget-close');
        closeBtn.addEventListener('click', () => this.close());
      }
      
      // Backdrop click
      if (this.config.backdrop) {
        this.modal.addEventListener('click', (e) => {
          if (e.target === this.modal) {
            this.close();
          }
        });
      }
      
      // Keyboard events
      if (this.config.keyboard) {
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && this.isOpen) {
            this.close();
          }
        });
      }
      
      // Focus trap for accessibility
      if (this.config.focusTrap) {
        this.modal.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            this.trapFocus(e);
          }
        });
      }
      
      // Theme change detection
      if (this.config.theme === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => this.applyTheme());
      }
    }

    trapFocus(e) {
      const focusableElements = this.modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }

    applyTheme() {
      let theme = this.config.theme;
      
      if (theme === 'auto') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = isDark ? 'dark' : 'light';
      }
      
      this.container.classList.toggle('aureos-widget-dark', theme === 'dark');
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }

    open() {
      this.isOpen = true;
      this.modal.classList.add('aureos-modal-open');
      document.body.style.overflow = 'hidden';
      
      // Load content
      this.loadContent();
      
      // Focus first element
      setTimeout(() => {
        const firstFocusable = this.modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }, 300);
    }

    close() {
      this.isOpen = false;
      this.modal.classList.remove('aureos-modal-open');
      document.body.style.overflow = '';
      
      // Return focus to button
      this.button.focus();
    }

    async loadContent() {
      this.showLoading();
      
      try {
        // Load available surveys
        const surveys = await this.fetchSurveys();
        
        if (surveys.length === 0) {
          this.showFeedbackForm();
        } else {
          this.showSurveySelection(surveys);
        }
      } catch (error) {
        console.error('Error loading content:', error);
        this.showFeedbackForm(); // Fallback to feedback form
      }
    }

    async fetchSurveys() {
      try {
        const response = await fetch(`${this.config.apiUrl}/api/public/surveys/${this.config.projectId}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result.success ? result.data : [];
      } catch (error) {
        console.error('Error fetching surveys:', error);
        return [];
      }
    }

    showLoading() {
      this.content.innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid var(--aureos-primary-color, #007bff); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 16px; color: #666;">Loading...</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }

    showFeedbackForm() {
      this.content.innerHTML = `
        <form id="aureos-feedback-form">
          <div class="aureos-widget-form-group">
            <label class="aureos-widget-label" for="feedback-email">Email (optional)</label>
            <input type="email" id="feedback-email" class="aureos-widget-input" placeholder="your@email.com">
          </div>
          
          <div class="aureos-widget-form-group">
            <label class="aureos-widget-label" for="feedback-text">Your feedback *</label>
            <textarea id="feedback-text" class="aureos-widget-textarea" required 
                     placeholder="Tell us what you think..." maxlength="1000"></textarea>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              <span id="feedback-char-count">0</span>/1000 characters
            </div>
          </div>
          
          <button type="submit" class="aureos-widget-button-primary" id="feedback-submit">
            Submit Feedback
          </button>
        </form>
        
        ${this.config.showPoweredBy ? '<p style="text-align: center; margin-top: 16px; font-size: 12px; color: #999;">Powered by Aureos</p>' : ''}
      `;
      
      // Set up form handlers
      this.setupFeedbackForm();
    }

    setupFeedbackForm() {
      const form = this.content.querySelector('#aureos-feedback-form');
      const textarea = this.content.querySelector('#feedback-text');
      const submitBtn = this.content.querySelector('#feedback-submit');
      const charCount = this.content.querySelector('#feedback-char-count');
      
      // Character count
      textarea.addEventListener('input', () => {
        const count = textarea.value.length;
        charCount.textContent = count;
        if (count > 1000) {
          charCount.style.color = '#dc3545';
        } else {
          charCount.style.color = '#666';
        }
      });
      
      // Form submission
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = this.content.querySelector('#feedback-email').value.trim();
        const feedback = textarea.value.trim();
        
        if (!feedback) {
          alert('Please enter your feedback');
          return;
        }
        
        this.isLoading = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        
        try {
          const response = await fetch(`${this.config.apiUrl}/api/public/feedback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              project_id: this.config.projectId,
              email: email || null,
              feedback: feedback,
              source: 'widget'
            })
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          this.showSuccess('Thank you for your feedback! We appreciate your input.');
          
        } catch (error) {
          console.error('Error submitting feedback:', error);
          alert('Sorry, there was an error submitting your feedback. Please try again.');
        } finally {
          this.isLoading = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Feedback';
        }
      });
    }

    showSurveySelection(surveys) {
      const surveyCards = surveys.map(survey => `
        <div class="aureos-widget-form-group">
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 16px; cursor: pointer; transition: border-color 0.2s;" 
               onclick="window.aureosWidget.startSurvey('${survey.id}')">
            <h4 style="margin: 0 0 8px 0; color: #333;">${survey.title}</h4>
            ${survey.description ? `<p style="margin: 0; color: #666; font-size: 14px;">${survey.description}</p>` : ''}
          </div>
        </div>
      `).join('');
      
      this.content.innerHTML = `
        <div>
          <h4 style="margin: 0 0 16px 0; color: #333;">Choose a survey:</h4>
          ${surveyCards}
          <button type="button" class="aureos-widget-button-primary" style="margin-top: 16px; background: #6c757d;" 
                  onclick="window.aureosWidget.showFeedbackForm()">
            Give General Feedback Instead
          </button>
        </div>
        
        ${this.config.showPoweredBy ? '<p style="text-align: center; margin-top: 16px; font-size: 12px; color: #999;">Powered by Aureos</p>' : ''}
      `;
    }

    async startSurvey(surveyId) {
      this.showLoading();
      
      try {
        const survey = await this.fetchSurvey(surveyId);
        if (survey) {
          this.currentSurvey = survey;
          this.showSurvey(survey);
        } else {
          throw new Error('Survey not found');
        }
      } catch (error) {
        console.error('Error loading survey:', error);
        this.showFeedbackForm();
      }
    }

    async fetchSurvey(surveyId) {
      try {
        const response = await fetch(`${this.config.apiUrl}/api/public/surveys/${this.config.projectId}/${surveyId}`, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result.success ? result.data : null;
      } catch (error) {
        console.error('Error fetching survey:', error);
        return null;
      }
    }

    showSurvey(survey) {
      if (survey.is_nps) {
        this.showNPSSurvey(survey);
      } else {
        this.showRegularSurvey(survey);
      }
    }

    showNPSSurvey(survey) {
      this.content.innerHTML = `
        <div class="aureos-nps-container">
          <div class="aureos-nps-question">${survey.questions[0].question_text}</div>
          <div class="aureos-nps-scale">
            ${Array.from({ length: 11 }, (_, i) => `
              <button type="button" class="aureos-nps-button" data-score="${i}" 
                      onclick="window.aureosWidget.selectNPSScore(${i})">
                ${i}
              </button>
            `).join('')}
          </div>
          <div class="aureos-nps-labels">
            <span>Not likely</span>
            <span>Extremely likely</span>
          </div>
          ${survey.questions.length > 1 ? `
            <div id="nps-follow-up" style="display: none; margin-top: 20px;">
              <div class="aureos-widget-form-group">
                <label class="aureos-widget-label">${survey.questions[1].question_text}</label>
                <textarea class="aureos-widget-textarea" id="nps-feedback" placeholder="Please share your thoughts..."></textarea>
              </div>
              <button type="button" class="aureos-widget-button-primary" onclick="window.aureosWidget.submitNPS()">
                Submit
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }

    showRegularSurvey(survey) {
      const questionHtml = survey.questions.map((question, index) => `
        <div class="aureos-widget-form-group">
          <label class="aureos-widget-label">${index + 1}. ${question.question_text}${question.required ? ' *' : ''}</label>
          ${this.renderQuestionInput(question)}
        </div>
      `).join('');
      
      this.content.innerHTML = `
        <form id="aureos-survey-form">
          ${questionHtml}
          <button type="submit" class="aureos-widget-button-primary">Submit Survey</button>
        </form>
        
        ${this.config.showPoweredBy ? '<p style="text-align: center; margin-top: 16px; font-size: 12px; color: #999;">Powered by Aureos</p>' : ''}
      `;
      
      // Set up form handlers
      this.setupSurveyForm(survey);
    }

    renderQuestionInput(question) {
      switch (question.question_type) {
        case 'text':
          return `<textarea class="aureos-widget-textarea" name="question_${question.id}" ${question.required ? 'required' : ''}></textarea>`;
        
        case 'rating':
          const maxRating = question.options?.[0]?.max_rating || 5;
          return `
            <div style="display: flex; gap: 4px;">
              ${Array.from({ length: maxRating }, (_, i) => `
                <button type="button" class="aureos-nps-button" style="width: 32px; height: 32px;" 
                        onclick="window.aureosWidget.selectRating(this, ${i + 1})" data-rating="${i + 1}">
                  ${i + 1}
                </button>
              `).join('')}
              <input type="hidden" name="question_${question.id}" ${question.required ? 'required' : ''}>
            </div>
          `;
        
        case 'yes_no':
          return `
            <div style="display: flex; gap: 12px;">
              <label style="display: flex; align-items: center; gap: 4px;">
                <input type="radio" name="question_${question.id}" value="yes" ${question.required ? 'required' : ''}>
                Yes
              </label>
              <label style="display: flex; align-items: center; gap: 4px;">
                <input type="radio" name="question_${question.id}" value="no" ${question.required ? 'required' : ''}>
                No
              </label>
            </div>
          `;
        
        case 'single_choice':
          return `
            <select class="aureos-widget-select" name="question_${question.id}" ${question.required ? 'required' : ''}>
              <option value="">Select an option...</option>
              ${question.options?.map(option => `<option value="${option.value}">${option.text}</option>`).join('') || ''}
            </select>
          `;
        
        case 'multiple_choice':
          return `
            <div>
              ${question.options?.map(option => `
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <input type="checkbox" name="question_${question.id}" value="${option.value}">
                  ${option.text}
                </label>
              `).join('') || ''}
            </div>
          `;
        
        default:
          return `<input type="text" class="aureos-widget-input" name="question_${question.id}" ${question.required ? 'required' : ''}>`;
      }
    }

    setupSurveyForm(survey) {
      const form = this.content.querySelector('#aureos-survey-form');
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const answers = [];
        
        survey.questions.forEach(question => {
          if (question.question_type === 'multiple_choice') {
            const selectedValues = formData.getAll(`question_${question.id}`);
            answers.push({
              question_id: question.id,
              answer_value: selectedValues
            });
          } else if (question.question_type === 'rating') {
            const rating = formData.get(`question_${question.id}`);
            answers.push({
              question_id: question.id,
              answer_value: parseInt(rating)
            });
          } else {
            const value = formData.get(`question_${question.id}`);
            answers.push({
              question_id: question.id,
              answer_text: value,
              answer_value: value
            });
          }
        });
        
        this.submitSurveyResponse(survey.id, answers);
      });
    }

    selectNPSScore(score) {
      // Remove previous selection
      this.content.querySelectorAll('.aureos-nps-button').forEach(btn => {
        btn.classList.remove('selected');
      });
      
      // Select current score
      const button = this.content.querySelector(`[data-score="${score}"]`);
      button.classList.add('selected');
      
      // Store response
      this.responses.set('nps_score', score);
      
      // Show follow-up question if exists
      const followUp = this.content.querySelector('#nps-follow-up');
      if (followUp && this.currentSurvey.questions.length > 1) {
        followUp.style.display = 'block';
      } else {
        // Submit immediately if no follow-up
        setTimeout(() => this.submitNPS(), 300);
      }
    }

    selectRating(button, rating) {
      // Remove previous selection
      const container = button.parentElement;
      container.querySelectorAll('.aureos-nps-button').forEach(btn => {
        btn.classList.remove('selected');
      });
      
      // Select current rating
      button.classList.add('selected');
      
      // Update hidden input
      const hiddenInput = container.parentElement.querySelector('input[type="hidden"]');
      hiddenInput.value = rating;
    }

    async submitNPS() {
      const feedback = this.content.querySelector('#nps-feedback')?.value?.trim();
      const npsScore = this.responses.get('nps_score');
      
      if (npsScore === undefined) {
        alert('Please select a score');
        return;
      }
      
      const answers = [
        {
          question_id: this.currentSurvey.questions[0].id,
          answer_value: npsScore
        }
      ];
      
      if (feedback && this.currentSurvey.questions.length > 1) {
        answers.push({
          question_id: this.currentSurvey.questions[1].id,
          answer_text: feedback,
          answer_value: feedback
        });
      }
      
      this.submitSurveyResponse(this.currentSurvey.id, answers);
    }

    async submitSurveyResponse(surveyId, answers) {
      this.isLoading = true;
      const submitBtn = this.content.querySelector('.aureos-widget-button-primary');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }
      
      try {
        const response = await fetch(`${this.config.apiUrl}/api/public/surveys/${this.config.projectId}/${surveyId}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            answers: answers,
            metadata: {
              source: 'widget',
              user_agent: navigator.userAgent,
              timestamp: new Date().toISOString()
            }
          })
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('rate_limited');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        this.showSuccess('Thank you for your response! Your feedback helps us improve.');
        
      } catch (error) {
        console.error('Error submitting survey:', error);
        if (error.message === 'rate_limited') {
          alert('Too many submissions. Please wait a moment before trying again.');
        } else {
          alert('Sorry, there was an error submitting your response. Please try again.');
        }
      } finally {
        this.isLoading = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Survey';
        }
      }
    }

    showSuccess(message) {
      this.content.innerHTML = `
        <div class="aureos-widget-success">
          <div class="aureos-widget-success-icon">✓</div>
          <div class="aureos-widget-success-message">${message}</div>
          <button class="aureos-widget-button-primary" onclick="window.aureosWidget.close()">
            Close
          </button>
        </div>
      `;
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        if (this.isOpen) {
          this.close();
        }
      }, 3000);
    }
  }

  // Global initialization function
  window.AureosWidget = function(config) {
    const widget = new AureosWidget(config);
    window.aureosWidget = widget; // Make accessible globally for inline handlers
    return widget;
  };

  // Auto-initialize if data attributes are found
  document.addEventListener('DOMContentLoaded', function() {
    const widgetElements = document.querySelectorAll('[data-aureos-widget]');
    
    widgetElements.forEach(element => {
      const projectId = element.getAttribute('data-aureos-project-id');
      const apiUrl = element.getAttribute('data-aureos-api-url') || window.location.origin;
      
      if (projectId) {
        const config = {
          projectId: projectId,
          apiUrl: apiUrl,
          position: element.getAttribute('data-aureos-position') || 'bottom-right',
          primaryColor: element.getAttribute('data-aureos-color') || '#007bff',
          title: element.getAttribute('data-aureos-title') || 'Feedback',
          buttonText: element.getAttribute('data-aureos-button-text') || 'Feedback'
        };
        
        new AureosWidget(config);
      }
    });
  });

})(window, document);