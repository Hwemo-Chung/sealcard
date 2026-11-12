import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { CardFace } from '../components/CardFace';
import { PrimaryButton } from '../components/PrimaryButton';
import { pressLock } from '../components/pressLock';
import { createSealSave, type SealPhase, type SealSave } from '../domain/sealSave';
import type { Binder, DateFormatId, TemplateId } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { pickerSealHooks } from '../navigation/pickerSeal';
import type { LateSealOutcome } from '../navigation/sealNotice';
import * as repo from '../storage/repository';
import { colors, space } from '../theme';

type Props = {
  photoUri: string;
  templateId: TemplateId;
  dateFormatId: DateFormatId;
  sealedAtIso: string;
  compositeUri: string;
  width: number;
  height: number;
  showDate: boolean;
  locationLabel: string | null;
  showBinderName: boolean;
  /** binderId null: the chosen binder was deleted meanwhile, the card is unsorted. */
  onDone: (cardId: string, binderId: string | null) => void;
  onCancel: () => void;
  /** Save phase for the hardware back handler. Must be a stable callback. */
  onSealPhaseChange: (phase: SealPhase) => void;
  /** The save settled after this screen was left (stall → Cancel/back): App reports it. */
  onLateSeal: (outcome: LateSealOutcome) => void;
};

export function PickBinderScreen({
  photoUri,
  templateId,
  dateFormatId,
  sealedAtIso,
  compositeUri,
  width,
  height,
  showDate,
  locationLabel,
  showBinderName,
  onDone,
  onCancel,
  onSealPhaseChange,
  onLateSeal,
}: Props) {
  const { t } = useI18n();
  const [binders, setBinders] = useState<Binder[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [phase, setPhase] = useState<SealPhase>('idle');
  const [creating, setCreating] = useState(false);
  /**
   * While a save runs (or stalled), the binder choice is frozen: the save writes
   * to the binder chosen at Done, and its stamped title is captured from this screen.
   */
  const locked = phase !== 'idle';
  /**
   * One save per capture (synchronous lock: two taps in one frame start one seal),
   * with a stall watchdog. Created per mount; disposed on leave so a late result
   * never navigates.
   */
  const sealRef = useRef<SealSave | null>(null);
  const cardRef = useRef<View>(null);
  const selectedName =
    binders.find((b) => b.id === selected)?.name ?? null;

  useEffect(() => {
    const session = createSealSave();
    sealRef.current = session;
    return () => {
      session.dispose();
      sealRef.current = null;
    };
  }, []);

  // Leaving the screen ends the saving state (success navigates away via onDone).
  useEffect(() => () => onSealPhaseChange('idle'), [onSealPhaseChange]);

  useEffect(() => {
    let alive = true;
    repo
      .listBinders()
      .then((list) => {
        if (!alive) return;
        setBinders(list);
        if (list[0]) setSelected(list[0].id);
      })
      .catch(() => {
        // The list stays empty; "new binder" still works.
        if (alive) Alert.alert(t('pickBinder.loadFailTitle'), t('pickBinder.failBody'));
      });
    return () => {
      alive = false;
    };
    // Load once per mount; `t` is read when the load settles.
  }, []);

  const createAndSelect = async () => {
    if (creating || locked) return;
    setCreating(true);
    try {
      const b = await repo.createBinder(newName.trim() || t('pickBinder.defaultName'));
      setBinders((prev) => [b, ...prev]);
      setSelected(b.id);
      setNewName('');
    } catch {
      Alert.alert(t('binders.createFailTitle'), t('binders.createFailBody'));
    } finally {
      setCreating(false);
    }
  };

  const seal = () => {
    if (!selected) {
      Alert.alert(t('pickBinder.needSelect'));
      return;
    }
    const session = sealRef.current;
    if (!session) return;
    const binderId = selected;
    // The lock and the 'saving' phase are set before the first await, so a back
    // press during the save is already swallowed. After SEAL_STALL_MS the phase
    // becomes 'stalled': Cancel/back work again, Done stays locked (domain/sealSave).
    session.start(
      async () => {
        let finalUri = compositeUri;
        let finalW = width;
        let finalH = height;

        // Binder title is only known here — re-capture chrome with real name.
        if (showBinderName && cardRef.current) {
          // Let layout paint selected binder label
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
          await new Promise((r) => setTimeout(r, 50));
          finalUri = await captureRef(cardRef, {
            format: 'jpg',
            quality: 0.92,
            result: 'tmpfile',
          });
          finalW = Math.round(width);
          finalH = Math.round(height);
        }

        // Resolves with the stored row: its binderId is null if `binderId` was
        // deleted meanwhile, and pickerSealHooks reports that row, not the selection.
        return repo.sealCard({
          binderId,
          templateId,
          dateFormatId,
          compositeUri: finalUri,
          width: finalW,
          height: finalH,
          sealedAt: sealedAtIso,
        });
      },
      pickerSealHooks({
        phase: (next) => {
          onSealPhaseChange(next);
          setPhase(next);
        },
        // Stays 'saving': onDone navigates away and the unmount clears it, so back
        // stays swallowed until the new screen's handler is in place.
        done: onDone,
        failed: () => Alert.alert(t('pickBinder.failTitle'), t('pickBinder.failBody')),
        late: onLateSeal,
      }),
    );
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('pickBinder.title')}</Text>
      <FlatList
        data={binders}
        keyExtractor={(b) => b.id}
        style={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('pickBinder.empty')}</Text>
        }
        renderItem={({ item }) => {
          const active = item.id === selected;
          return (
            <Pressable
              {...pressLock(locked, () => setSelected(item.id))}
              style={[styles.row, active && styles.rowActive, locked && !active && styles.rowLocked]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: locked }}
            >
              <Text style={styles.rowText}>{item.name}</Text>
            </Pressable>
          );
        }}
      />
      <View style={styles.create}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder={t('pickBinder.placeholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={!locked}
        />
        <PrimaryButton
          label={t('pickBinder.newBinder')}
          onPress={() => void createAndSelect()}
          disabled={locked}
          loading={creating}
          variant="ghost"
        />
      </View>
      {phase === 'stalled' ? (
        <Text style={styles.stalled} accessibilityLiveRegion="polite">
          {t('pickBinder.stalledBody')}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          label={t('common.cancel')}
          onPress={onCancel}
          disabled={phase === 'saving'}
          variant="ghost"
          style={styles.btn}
        />
        <PrimaryButton
          label={t('pickBinder.finish')}
          onPress={seal}
          loading={phase === 'saving'}
          disabled={phase === 'stalled' || creating}
          style={styles.btn}
        />
      </View>

      {/* Off-screen final composite when binder name stamp is on */}
      {showBinderName ? (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <CardFace
            ref={cardRef}
            photoUri={photoUri}
            templateId={templateId}
            dateFormatId={dateFormatId}
            sealedAtIso={sealedAtIso}
            width={width}
            showDate={showDate}
            locationLabel={locationLabel}
            binderLabel={selectedName}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    marginBottom: space.md,
  },
  list: { flex: 1, paddingHorizontal: space.md },
  empty: { color: colors.textMuted, marginBottom: space.md },
  row: {
    padding: space.md,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space.sm,
  },
  rowActive: {
    borderColor: colors.accent,
  },
  rowLocked: {
    opacity: 0.5,
  },
  rowText: { color: colors.text, fontSize: 16 },
  create: {
    padding: space.md,
    gap: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    paddingBottom: space.lg,
  },
  btn: { flex: 1 },
  stalled: {
    color: colors.textMuted,
    fontSize: 14,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
  },
  offscreen: {
    position: 'absolute',
    left: -4000,
    top: 0,
  },
});
