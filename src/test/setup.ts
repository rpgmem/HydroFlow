// Global test setup. `@testing-library/jest-dom` matchers are only needed by
// component tests (jsdom env), but importing them here is harmless under node.
import '@testing-library/jest-dom/vitest';
// Inicializa o i18next para os testes de componente (força 'pt' em MODE=test, ver
// src/i18n). Sem isto, componentes renderizados isolados devolveriam as CHAVES.
import '../i18n';
