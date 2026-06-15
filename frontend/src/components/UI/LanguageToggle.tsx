import { LanguageIconOutline } from '@neo4j-ndl/react/icons';
import { Tooltip } from '@neo4j-ndl/react';
import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { tr } from '../../i18n';

// Toggles the UI between Chinese and English. Shows the label of the language
// the user will switch TO so the action is obvious.
const LanguageToggle = ({ placement = 'bottom' }: { placement?: 'bottom' | 'top' | 'right' | 'left' }) => {
  const { language, toggleLanguage } = useLanguage();
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const targetLabel = language === 'zh' ? tr('language.english') : tr('language.chinese');

  return (
    <Tooltip type='simple' placement={placement}>
      <Tooltip.Trigger hasButtonWrapper>
        <button
          type='button'
          aria-label={tr('language.label')}
          onClick={toggleLanguage}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className='flex items-center gap-1 rounded-md px-2 py-1 n-text-palette-neutral-text-weak hover:n-bg-palette-neutral-hover-weak'
        >
          <LanguageIconOutline className='n-size-token-6' />
          <span className='text-sm font-medium'>{targetLabel}</span>
        </button>
      </Tooltip.Trigger>
      {isHovered && <Tooltip.Content style={{ whiteSpace: 'nowrap' }}>{tr('language.label')}</Tooltip.Content>}
    </Tooltip>
  );
};

export default LanguageToggle;
