/**
 * Form Fields – Glassmorphism Controls
 *
 * Stellt die neuen Form-Primitives des Design Systems dar.
 */

export default {
  title: 'Design System/Form Fields',
  parameters: {
    layout: 'padded',
    backgrounds: {
      default: 'assixx-dark',
    },
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Field label',
    },
    required: {
      control: 'boolean',
      description: 'Mark field as required',
    },
    message: {
      control: 'text',
      description: 'Helper message text',
    },
    placeholder: {
      control: 'text',
      description: 'Input placeholder',
    },
  },
};

const createField = ({
  id,
  label,
  required = false,
  message,
  control,
  helperVariant,
}) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelElement = document.createElement('label');
  labelElement.className = 'form-field__label';
  if (required) {
    labelElement.classList.add('form-field__label--required');
  }
  labelElement.setAttribute('for', id);
  labelElement.textContent = label;

  const controlElement = control(id);
  controlElement.classList.add('form-field__control');

  wrapper.appendChild(labelElement);
  wrapper.appendChild(controlElement);

  if (message) {
    const helper = document.createElement('p');
    helper.className = 'form-field__message';
    if (helperVariant) {
      helper.classList.add(`form-field__message--${helperVariant}`);
    }
    helper.textContent = message;
    wrapper.appendChild(helper);
  }

  return wrapper;
};

export const TextInput = {
  args: {
    label: 'Vorname',
    required: true,
    message: 'Wird auf allen Dokumenten angezeigt.',
    placeholder: 'Max',
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Field label',
    },
    required: {
      control: 'boolean',
      description: 'Mark as required',
    },
    message: {
      control: 'text',
      description: 'Helper text',
    },
    placeholder: {
      control: 'text',
      description: 'Input placeholder',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '400px';

    container.appendChild(
      createField({
        id: 'firstName',
        label: args.label,
        required: args.required,
        message: args.message,
        control: (id) => {
          const input = document.createElement('input');
          input.type = 'text';
          input.id = id;
          input.name = id;
          input.placeholder = args.placeholder;
          return input;
        },
      }),
    );

    return container;
  },
};

export const SelectAndInline = {
  args: {
    selectLabel: 'Abteilung',
    inlineLabel: 'Status',
    showSelect: true,
    showInline: true,
  },
  argTypes: {
    selectLabel: {
      control: 'text',
      description: 'Label for select dropdown',
    },
    inlineLabel: {
      control: 'text',
      description: 'Label for inline field',
    },
    showSelect: {
      control: 'boolean',
      description: 'Show standard select field',
    },
    showInline: {
      control: 'boolean',
      description: 'Show inline field variant',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gap = '32px';

    if (args.showSelect) {
      container.appendChild(
        createField({
          id: 'department',
          label: args.selectLabel,
          control: (id) => {
            const select = document.createElement('select');
            select.id = id;
            select.name = id;
            select.classList.add('form-field__control--select');

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.text = 'Bitte wählen';
            placeholder.disabled = true;
            placeholder.selected = true;
            select.appendChild(placeholder);

            ['Produktion', 'Qualität', 'Instandhaltung'].forEach((value) => {
              const option = document.createElement('option');
              option.value = value;
              option.text = value;
              select.appendChild(option);
            });

            return select;
          },
        }),
      );
    }

    if (args.showInline) {
      const inlineField = document.createElement('div');
      inlineField.className = 'form-field form-field--inline';

      const label = document.createElement('label');
      label.className = 'form-field__label';
      label.setAttribute('for', 'filter');
      label.textContent = args.inlineLabel;

      const select = document.createElement('select');
      select.id = 'filter';
      select.name = 'filter';
      select.className = 'form-field__control form-field__control--select';

      ['Alle', 'Aktiv', 'Inaktiv'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.text = value;
        select.appendChild(option);
      });

      inlineField.appendChild(label);
      inlineField.appendChild(select);
      container.appendChild(inlineField);
    }

    return container;
  },
};

export const ValidationStates = {
  args: {
    showError: true,
    showSuccess: true,
    showDisabled: true,
  },
  argTypes: {
    showError: {
      control: 'boolean',
      description: 'Show error state example',
    },
    showSuccess: {
      control: 'boolean',
      description: 'Show success state example',
    },
    showDisabled: {
      control: 'boolean',
      description: 'Show disabled state example',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.display = 'grid';
    container.style.gap = '24px';

    if (args.showError) {
      container.appendChild(
        createField({
          id: 'error',
          label: 'Maschinen-ID',
          message: 'ID existiert bereits.',
          helperVariant: 'error',
          control: (id) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = id;
            input.name = id;
            input.value = 'M-1001';
            input.classList.add('is-error');
            return input;
          },
        }),
      );
    }

    if (args.showSuccess) {
      container.appendChild(
        createField({
          id: 'success',
          label: 'Webhook URL',
          message: 'RFC-Format geprüft.',
          helperVariant: 'success',
          control: (id) => {
            const input = document.createElement('input');
            input.type = 'url';
            input.id = id;
            input.name = id;
            input.value = 'https://assixx.com/hooks/shift';
            input.classList.add('is-success');
            return input;
          },
        }),
      );
    }

    if (args.showDisabled) {
      container.appendChild(
        createField({
          id: 'disabled',
          label: 'Tenant',
          message: 'Nur Leserechte',
          helperVariant: 'warning',
          control: (id) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = id;
            input.name = id;
            input.value = 'SCS Technik GmbH';
            input.disabled = true;
            return input;
          },
        }),
      );
    }

    return container;
  },
};

export const SearchInput = {
  args: {
    label: 'Dokumente suchen',
    placeholder: 'Suchen Sie nach Dokumentname, Beschreibung oder Uploader...',
    icon: 'fa-search',
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Search field label',
    },
    placeholder: {
      control: 'text',
      description: 'Search placeholder text',
    },
    icon: {
      control: 'text',
      description: 'FontAwesome icon class (without fa- prefix)',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '600px';

    const field = document.createElement('div');
    field.className = 'form-field';

    const label = document.createElement('label');
    label.className = 'form-field__label';
    label.setAttribute('for', 'search');
    label.textContent = args.label;

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'form-field__input-wrapper';

    const icon = document.createElement('i');
    icon.className = `fas fa-${args.icon} form-field__icon`;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'search';
    input.name = 'search';
    input.className = 'form-field__control form-field__control--with-icon';
    input.placeholder = args.placeholder;
    input.autocomplete = 'off';

    inputWrapper.appendChild(icon);
    inputWrapper.appendChild(input);

    field.appendChild(label);
    field.appendChild(inputWrapper);

    container.appendChild(field);
    return container;
  },
};

export const PasswordToggle = {
  args: {
    label: 'Passwort',
    required: true,
    placeholder: 'Mindestens 8 Zeichen',
    showHelper: true,
    helperText: 'Verwenden Sie eine Kombination aus Buchstaben, Zahlen und Sonderzeichen',
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Password field label',
    },
    required: {
      control: 'boolean',
      description: 'Mark as required',
    },
    placeholder: {
      control: 'text',
      description: 'Input placeholder',
    },
    showHelper: {
      control: 'boolean',
      description: 'Show helper text',
    },
    helperText: {
      control: 'text',
      description: 'Helper message',
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.maxWidth = '400px';

    // Field wrapper
    const field = document.createElement('div');
    field.className = 'form-field';

    // Label
    const label = document.createElement('label');
    label.className = 'form-field__label';
    if (args.required) {
      label.classList.add('form-field__label--required');
    }
    label.setAttribute('for', 'password');
    label.textContent = args.label;

    // Password wrapper (contains input + toggle button)
    const passwordWrapper = document.createElement('div');
    passwordWrapper.className = 'form-field__password-wrapper';

    // Password input
    const input = document.createElement('input');
    input.type = 'password';
    input.id = 'password';
    input.name = 'password';
    input.className = 'form-field__control';
    input.placeholder = args.placeholder;

    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'form-field__password-toggle';
    toggleButton.setAttribute('aria-label', 'Passwort anzeigen');
    toggleButton.id = 'password-toggle';

    // Eye icon
    const icon = document.createElement('i');
    icon.className = 'fas fa-eye';

    toggleButton.appendChild(icon);
    passwordWrapper.appendChild(input);
    passwordWrapper.appendChild(toggleButton);

    field.appendChild(label);
    field.appendChild(passwordWrapper);

    // Helper text
    if (args.showHelper) {
      const helper = document.createElement('p');
      helper.className = 'form-field__message';
      helper.textContent = args.helperText;
      field.appendChild(helper);
    }

    container.appendChild(field);

    // Add interactive toggle functionality
    setTimeout(() => {
      toggleButton.addEventListener('click', () => {
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
          toggleButton.setAttribute('aria-label', 'Passwort verstecken');
        } else {
          input.type = 'password';
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
          toggleButton.setAttribute('aria-label', 'Passwort anzeigen');
        }
      });
    }, 0);

    return container;
  },
};
