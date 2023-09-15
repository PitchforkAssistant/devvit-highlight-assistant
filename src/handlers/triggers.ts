import {ModMail} from "@devvit/protos";
import {TriggerContext, OnTriggerEvent, ModMailConversationState} from "@devvit/public-api";
import {toStringOrDefault} from "devvit-helpers";

// Mod Triggers
export async function onModMail (event: OnTriggerEvent<ModMail>, context: TriggerContext) {
    const allSettings = await context.settings.getAll();
    const highlightUsernames = toStringOrDefault(allSettings.usernames, "").toLowerCase().split(",");
    const highlightAdmins = allSettings.admins as boolean;
    const highlightContributors = allSettings.contributors as boolean;
    const highlightSubreddits = allSettings.subreddits as boolean;
    const highlightAutoGenerated = allSettings.autoGenerated as boolean;
    const highlightSent = allSettings.sent as boolean;

    if (!highlightAutoGenerated && event.isAutoGenerated) {
        console.log(`Ignoring auto-generated modmail: ${JSON.stringify(event)}`);
        return;
    }

    const modmail = await context.reddit.modMail.getConversation({conversationId: event.conversationId});

    // Only auto-highlight when a new modmail thread is created.
    if (modmail.conversation?.numMessages !== 1) {
        console.log(`Ignoring further modmail replies: ${JSON.stringify(event)}`);
        return;
    }

    // Don't highlight modmails sent by the subreddit if that's disabled.
    if (!highlightSent) {
        // If the participant exists and isn't an op, then it's a sent modmail.
        if (modmail.conversation.participant && !modmail.conversation.participant.isOp) {
            console.log(`Ignoring modmail sent to user: ${JSON.stringify(event)}`);
            return;
        }
        // If the participating subreddit exists and isn't the owner subreddit, then it's a sent modmail.
        if (modmail.conversation.conversationType === "sr_sr" && modmail.conversation.subreddit?.id !== (await context.reddit.getCurrentSubreddit()).id) {
            console.log(`Ignoring modmail sent to subreddit: ${JSON.stringify(event)}`);
            return;
        }
    }

    // Don't highlight modmails if they're already highlighted, although this should never happen.
    if (modmail.conversation?.isHighlighted) {
        console.log(`Ignoring already highlighted modmail: ${JSON.stringify(event)}`);
        return;
    }

    // Don't highlight modmails if they're already archived, also seems unlikely.
    if (modmail.conversation.state === ModMailConversationState.Archived) {
        console.log(`Ignoring archived modmail: ${JSON.stringify(event)}`);
        return;
    }

    // Highlight modmails from other subreddits if enabled.
    if (highlightSubreddits && modmail.conversation.conversationType === "sr_sr") {
        console.log(`Highlighting sr_sr modmail: ${JSON.stringify(event)}`);
        await context.reddit.modMail.highlightConversation(event.conversationId).catch(error => {
            console.error("Failed to highlight sr_sr modmail:", error);
        });
    }

    // Highlight modmails from admins if enabled.
    if (highlightAdmins && modmail.conversation.participant?.isAdmin) {
        console.log(`Highlighting admin modmail: ${JSON.stringify(event)}`);
        await context.reddit.modMail.highlightConversation(event.conversationId).catch(error => {
            console.error("Failed to highlight admin modmail:", error);
        });
    }

    // Highlight modmails from approved contributors if enabled.
    if (highlightContributors && modmail.conversation.participant?.isApproved) {
        console.log(`Highlighting contributor modmail: ${JSON.stringify(event)}`);
        await context.reddit.modMail.highlightConversation(event.conversationId).catch(error => {
            console.error("Failed to highlight contributor modmail:", error);
        });
    }

    // Highlight modmails from usernames if enabled.
    if (highlightUsernames) {
        if (modmail.conversation.participant?.name && highlightUsernames.includes(modmail.conversation.participant.name.toLowerCase())) {
            console.log(`Highlighting username modmail: ${JSON.stringify(event)}`);
            await context.reddit.modMail.highlightConversation(event.conversationId).catch(error => {
                console.error("Failed to highlight user modmail:", error);
            });
        }
    }
}
