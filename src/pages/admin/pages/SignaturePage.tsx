import { faEraser } from '@fortawesome/free-solid-svg-icons';
import { AdminPage, Loaded, Panel, Section } from '../components/ui';
import { useGetMyProfile } from '@/api/Api';
import Button from '@/components/Button';
import useLocalStorage from '@/hooks/useLocalStorage';
import Polaroid from '@/pages/feed/components/Polaroid';
import { SignatureMark, SignaturePad } from '@/signature/Signature';

/**
 * A try-out of artist signatures before they ship: sign once, then see it on
 * your own polaroids. Kept in this browser only; nothing reaches the server.
 */
const SignaturePage = () => {
  const [signature, setSignature] = useLocalStorage('ADMIN_SIGNATURE', '', 0);
  const profile = useGetMyProfile();

  return (
    <AdminPage
      title="signature"
      subtitle="not released yet: sign here to see how it looks on your polaroids"
    >
      <div className="grid grid-cols-[minmax(0,480px)_1fr] gap-8 items-start">
        <Section title="sign">
          <Panel className="flex flex-col gap-3 p-4">
            <SignaturePad
              path={signature}
              onChange={setSignature}
              className="w-full aspect-[3/1] bg-paper rounded-sketch-alt"
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-pencil">
                {signature.length} bytes · saved in this browser only
              </span>
              <Button
                size="sm"
                variant="base"
                icon={faEraser}
                disableLoad
                disabled={!signature}
                onClick={() => setSignature('')}
              >
                start over
              </Button>
            </div>
          </Panel>
          {signature && (
            <Panel className="flex items-end gap-6 p-4">
              {['w-12', 'w-18', 'w-30'].map((width) => (
                <SignatureMark key={width} path={signature} className={width} />
              ))}
              <span className="text-sm text-pencil">at polaroid sizes</span>
            </Panel>
          )}
        </Section>

        <Section title="on your polaroids">
          <Loaded query={profile}>
            {({ prompts }) =>
              prompts.length === 0 ? (
                <p className="text-pencil">
                  draw something first to see it here
                </p>
              ) : (
                // Phone width, like the wall on Today
                <div className="grid grid-cols-2 gap-x-3.5 gap-y-5 w-[390px] p-4 paper">
                  {prompts.slice(0, 4).map((submission, index) => (
                    <Polaroid
                      key={submission.id}
                      submission={submission}
                      index={index}
                      signature={signature || undefined}
                    />
                  ))}
                </div>
              )
            }
          </Loaded>
        </Section>
      </div>
    </AdminPage>
  );
};

export default SignaturePage;
