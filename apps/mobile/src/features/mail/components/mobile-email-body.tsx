import { Alert, Linking, Text, View } from "react-native";

import type {
  EmailTextBlock,
  EmailTextInline,
} from "@rodge-mail/features/mail";
import { parseEmailText } from "@rodge-mail/features/mail";

export function MobileEmailBody({
  messageId,
  source,
}: {
  messageId: string;
  source: string | readonly string[] | undefined;
}) {
  const blocks = parseEmailText(source);
  if (blocks.length === 0) {
    return (
      <Text className="text-muted-foreground text-[16px] leading-7">
        This message body has not been downloaded yet.
      </Text>
    );
  }
  return blocks.map((block, index) => (
    <MobileEmailBlock
      block={block}
      key={`${messageId}-${block.type}-${index}`}
    />
  ));
}

function MobileEmailBlock({ block }: { block: EmailTextBlock }) {
  if (block.type === "paragraph") {
    return <MobileInlineText content={block.content} />;
  }
  if (block.type === "quote") {
    return (
      <View className="border-border gap-3 border-l-2 pl-4">
        {block.paragraphs.map((paragraph, index) => (
          <MobileInlineText content={paragraph} key={index} muted />
        ))}
      </View>
    );
  }
  return (
    <View className="gap-2">
      {block.items.map((item, index) => (
        <View className="flex-row items-start gap-2" key={index}>
          <Text className="text-muted-foreground w-5 text-right text-[15px] leading-7">
            {getListMarker(block, index)}
          </Text>
          <View className="min-w-0 flex-1">
            <MobileInlineText content={item} />
          </View>
        </View>
      ))}
    </View>
  );
}

function getListMarker(
  block: Extract<EmailTextBlock, { type: "list" }>,
  index: number,
) {
  if (!block.ordered) return "•";
  return `${(block.start ?? 1) + index}.`;
}

function MobileInlineText({
  content,
  muted = false,
}: {
  content: EmailTextInline[];
  muted?: boolean;
}) {
  return (
    <Text className={getTextClassName(muted)} selectable>
      {content.map((token, index) => (
        <MobileInlineToken key={`${token.type}-${index}`} token={token} />
      ))}
    </Text>
  );
}

function getTextClassName(muted: boolean) {
  if (muted) return "text-muted-foreground text-[15px] leading-7";
  return "text-foreground text-[16px] leading-7";
}

function MobileInlineToken({ token }: { token: EmailTextInline }) {
  if (token.type === "text") return token.value;
  return (
    <Text
      accessibilityHint={token.href}
      accessibilityRole="link"
      className="text-primary font-semibold underline"
      onPress={() => void openEmailLink(token.href)}
      suppressHighlighting
    >
      {token.display}
    </Text>
  );
}

async function openEmailLink(href: string) {
  try {
    await Linking.openURL(href);
  } catch {
    Alert.alert("Couldn’t open link", href);
  }
}
