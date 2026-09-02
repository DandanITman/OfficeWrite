import { CircleHelp, Keyboard, Megaphone, MessageCircleQuestion, Sparkles } from 'lucide-react';
import { RibbonButton, RibbonGroup, RibbonLine } from '../RibbonKit';
import type { RibbonTabProps } from '../types';

/**
 * Help.
 *
 * A hosted suite points these at its own support site; Officewrite points
 * them at its own repository, opened in the user's browser rather than in a
 * window here. What's New shows the bundled changelog, so it works offline.
 */
export function HelpTab({ actions }: RibbonTabProps) {
  return (
    <RibbonGroup label="Help">
      <RibbonLine>
        <RibbonButton
          icon={<CircleHelp size={20} />}
          label="Help"
          title="Open the Officewrite project on GitHub"
          size="large"
          onClick={actions.onOpenHelp}
          testId="help-open"
        />
        <RibbonButton
          icon={<MessageCircleQuestion size={20} />}
          label="Contact Support"
          title="Browse or raise an issue on GitHub"
          size="large"
          onClick={actions.onContactSupport}
          testId="help-support"
        />
        <RibbonButton
          icon={<Megaphone size={20} />}
          label="Feedback"
          title="Open a new issue on GitHub"
          size="large"
          onClick={actions.onSendFeedback}
          testId="help-feedback"
        />
        <RibbonButton
          icon={<Keyboard size={20} />}
          label="Keyboard Shortcuts"
          title="Every shortcut Officewrite binds"
          size="large"
          onClick={actions.onOpenShortcuts}
          testId="help-shortcuts"
        />
        <RibbonButton
          icon={<Sparkles size={20} />}
          label="What's New"
          title="What changed in this version"
          size="large"
          onClick={actions.onOpenWhatsNew}
          testId="help-whats-new"
        />
      </RibbonLine>
    </RibbonGroup>
  );
}
