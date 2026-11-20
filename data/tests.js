/*
 * Mock test data.
 * To add a test, copy one object in the `tests` array and give it a unique id.
 * `answer` is the zero-based index of the correct option.
 */
window.JLPT_DATA = {
  tests: [
    {
      id: "n5-test-1",
      title: "JLPT N5 Mock Test 1",
      description: "Core N5 vocabulary, grammar, reading, and audio-based listening practice.",
      duration: 60,
      questions: [
        {
          id: 1,
          section: "vocabulary",
          question: "「学校」の よみかたは どれですか。",
          options: ["がっこう", "がくこう", "がっこ", "がくこ"],
          answer: 0,
          explanation: "学校 is read がっこう and means “school.”"
        },
        {
          id: 2,
          section: "vocabulary",
          question: "「先生」の よみかたは どれですか。",
          options: ["せんせい", "せんぜい", "せいせん", "せんせ"],
          answer: 0,
          explanation: "先生 is read せんせい and means “teacher.”"
        },
        {
          id: 3,
          section: "vocabulary",
          question: "「きょう」の かんじは どれですか。",
          options: ["明日", "昨日", "今日", "毎日"],
          answer: 2,
          explanation: "今日 is read きょう and means “today.”"
        },
        {
          id: 4,
          section: "vocabulary",
          question: "くだものは どれですか。",
          options: ["りんご", "パン", "たまご", "さかな"],
          answer: 0,
          explanation: "りんご (apple) is a fruit."
        },
        {
          id: 5,
          section: "vocabulary",
          question: "「大きい」の はんたいの ことばは どれですか。",
          options: ["ながい", "ちいさい", "あたらしい", "ひろい"],
          answer: 1,
          explanation: "The opposite of 大きい (big) is 小さい／ちいさい (small)."
        },
        {
          id: 6,
          section: "grammar",
          question: "わたしは 毎日 日本語（　）勉強します。",
          options: ["が", "を", "に", "で"],
          answer: 1,
          explanation: "を marks 日本語 as the object of 勉強します."
        },
        {
          id: 7,
          section: "grammar",
          question: "これは だれ（　）かばんですか。",
          options: ["を", "で", "の", "へ"],
          answer: 2,
          explanation: "の shows possession: だれのかばん means “whose bag.”"
        },
        {
          id: 8,
          section: "grammar",
          question: "日曜日に 友だち（　）映画を 見ました。",
          options: ["と", "を", "へ", "が"],
          answer: 0,
          explanation: "と means “with” when doing something together with a person."
        },
        {
          id: 9,
          section: "grammar",
          question: "きのうは とても（　）。",
          options: ["さむいです", "さむかったです", "さむくです", "さむかったでした"],
          answer: 1,
          explanation: "The polite past form of the い-adjective さむい is さむかったです."
        },
        {
          id: 10,
          section: "grammar",
          question: "ここで 写真を（　）か。",
          options: ["撮っても いいです", "撮っては いけません", "撮りません", "撮りましょう"],
          answer: 0,
          explanation: "～てもいいですか asks for permission: “May I take a photo here?”"
        },
        {
          id: 11,
          section: "reading",
          question: "田中さんは 毎朝 六時半に 起きます。七時に パンと たまごを 食べて、コーヒーを 飲みます。八時に 会社へ 行きます。\n\n田中さんは 朝、何を 飲みますか。",
          options: ["みず", "おちゃ", "コーヒー", "ぎゅうにゅう"],
          answer: 2,
          explanation: "The passage says コーヒーを飲みます."
        },
        {
          id: 12,
          section: "reading",
          question: "図書館は 月曜日から 土曜日まで、午前九時から 午後六時までです。日曜日は 休みです。\n\n図書館が 休みなのは 何曜日ですか。",
          options: ["月曜日", "金曜日", "土曜日", "日曜日"],
          answer: 3,
          explanation: "日曜日は休みです means the library is closed on Sunday."
        },
        {
          id: 13,
          section: "reading",
          question: "みきさんは 土曜日の 午前に 部屋を そうじします。午後は お母さんと デパートで 買いものを します。\n\nみきさんは 土曜日の 午後、何を しますか。",
          options: ["そうじを します", "買いものを します", "勉強します", "仕事を します"],
          answer: 1,
          explanation: "The second sentence says she shops at a department store in the afternoon."
        },
        {
          id: 14,
          section: "reading",
          question: "山田さんへ\n三時に 電話を しましたが、いませんでした。四時に もう一度 電話を します。\n佐藤\n\n佐藤さんは つぎに 何時に 電話を しますか。",
          options: ["二時", "三時", "四時", "五時"],
          answer: 2,
          explanation: "四時にもう一度電話をします means Sato will call again at four."
        },
        {
          id: 15,
          section: "reading",
          question: "あした、いっしょに 公園へ 行きませんか。午前十時に 駅の 前で 会いましょう。雨の ときは、駅の となりの きっさてんへ 行きます。\n\nどこで 会いますか。",
          options: ["公園の 中", "駅の 前", "学校の 前", "きっさてんの 中"],
          answer: 1,
          explanation: "The message says 午前十時に駅の前で会いましょう."
        },
        {
          id: 101,
          section: "listening",
          type: "task",
          audio: "audio/test1/q101.mp3",
          audioSegments: [
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q101/01-narrator.mp3", text: "女の人と 男の人が 話して います。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q101/02-woman.mp3", text: "すみません、この 荷物を 車まで 持って 行って ください。", pauseAfter: 350 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q101/03-man.mp3", text: "はい。今すぐ 持って 行きます。", pauseAfter: 350 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q101/04-woman.mp3", text: "ありがとう ございます。", pauseAfter: 450 },
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q101/05-question.mp3", text: "男の人は このあと 何を しますか。", pauseAfter: 0 }
          ],
          script: "女の人と 男の人が 話して います。女の人：すみません、この 荷物を 車まで 持って 行って ください。男の人：はい。今すぐ 持って 行きます。女の人：ありがとう ございます。男の人は このあと 何を しますか。",
          scriptTranslation: "A woman asks a man to take this luggage to the car. He says he will take it right away. What will the man do next?",
          question: "男の人は このあと 何を しますか。",
          options: [
            { text: "荷物を 車まで 持って 行きます", image: "📦🚗" },
            { text: "部屋を そうじします", image: "🧹" },
            { text: "電話を します", image: "📞" },
            { text: "水を 飲みます", image: "🥤" }
          ],
          answer: 0,
          explanation: "The woman asks him to take the luggage to the car, and he says he will do it now."
        },
        {
          id: 102,
          section: "listening",
          type: "task",
          audio: "audio/test1/q102.mp3",
          audioSegments: [
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q102/01-narrator.mp3", text: "女の人と 男の人が 話して います。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q102/02-woman.mp3", text: "スーパーへ 行きますか。", pauseAfter: 300 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q102/03-man.mp3", text: "はい、行きます。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q102/04-woman.mp3", text: "では、牛乳を 買って ください。パンは うちに あります。", pauseAfter: 350 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q102/05-man.mp3", text: "わかりました。", pauseAfter: 450 },
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q102/06-question.mp3", text: "男の人は 何を 買いますか。", pauseAfter: 0 }
          ],
          script: "女の人と 男の人が 話して います。女の人：スーパーへ 行きますか。男の人：はい、行きます。女の人：では、牛乳を 買って ください。パンは うちに あります。男の人：わかりました。男の人は 何を 買いますか。",
          scriptTranslation: "A woman asks a man who is going to the supermarket to buy milk. They already have bread at home. What will he buy?",
          question: "男の人は 何を 買いますか。",
          options: ["パン", "牛乳", "たまご", "りんご"],
          answer: 1,
          explanation: "The woman says 牛乳を買ってください (please buy milk)."
        },
        {
          id: 103,
          section: "listening",
          type: "task",
          audio: "audio/test1/q103.mp3",
          script: "男の子が 話して います。学校の あと、図書館へ 行きます。本を 借りてから、うちへ 帰ります。男の子は 学校の あと、はじめに どこへ 行きますか。",
          scriptTranslation: "A boy says that after school he will go to the library. After borrowing a book, he will go home. Where will he go first after school?",
          question: "男の子は 学校の あと、はじめに どこへ 行きますか。",
          options: [
            { text: "スーパー", image: "🛒" },
            { text: "図書館", image: "📚" },
            { text: "うち", image: "🏠" },
            { text: "駅", image: "🚉" }
          ],
          answer: 1,
          explanation: "He says 学校のあと、図書館へ行きます (after school, I will go to the library)."
        },
        {
          id: 104,
          section: "listening",
          type: "point",
          audio: "audio/test1/q104.mp3",
          audioSegments: [
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q104/01-narrator.mp3", text: "女の人と 男の人が 話して います。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q104/02-woman.mp3", text: "日曜日に 映画を 見ませんか。", pauseAfter: 300 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q104/03-man.mp3", text: "いいですね。十時は どうですか。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q104/04-woman.mp3", text: "十時は 早いです。十一時に 駅で 会いましょう。", pauseAfter: 350 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q104/05-man.mp3", text: "はい。", pauseAfter: 450 },
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q104/06-question.mp3", text: "二人は 何時に 会いますか。", pauseAfter: 0 }
          ],
          script: "女の人と 男の人が 話して います。女の人：日曜日に 映画を 見ませんか。男の人：いいですね。十時は どうですか。女の人：十時は 早いです。十一時に 駅で 会いましょう。男の人：はい。二人は 何時に 会いますか。",
          scriptTranslation: "A woman and a man plan to see a movie on Sunday. Ten is too early, so they agree to meet at the station at eleven. What time will they meet?",
          question: "二人は 何時に 会いますか。",
          options: ["九時", "十時", "十一時", "十二時"],
          answer: 2,
          explanation: "The woman says 十一時に駅で会いましょう (let's meet at the station at eleven)."
        },
        {
          id: 105,
          section: "listening",
          type: "point",
          audio: "audio/test1/q105.mp3",
          audioSegments: [
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q105/01-narrator.mp3", text: "デパートで 女の人が 店の人に 聞いて います。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q105/02-woman.mp3", text: "すみません、くつは 何階ですか。", pauseAfter: 300 },
            { speaker: "clerk", label: "店の人", audio: "audio/test1/q105/03-clerk.mp3", text: "くつは 一階です。シャツは 二階です。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q105/04-woman.mp3", text: "ありがとう ございます。", pauseAfter: 450 },
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q105/05-question.mp3", text: "女の人は 何階へ 行きますか。", pauseAfter: 0 }
          ],
          script: "デパートで 女の人が 店の人に 聞いて います。女の人：すみません、くつは 何階ですか。店の人：くつは 一階です。シャツは 二階です。女の人：ありがとう ございます。女の人は 何階へ 行きますか。",
          scriptTranslation: "At a department store, a woman asks where the shoes are. The clerk says shoes are on the first floor and shirts are on the second floor. Which floor will she go to?",
          question: "女の人は 何階へ 行きますか。",
          options: ["一階", "二階", "三階", "四階"],
          answer: 0,
          explanation: "She wants shoes, and the clerk says the shoes are on the first floor."
        },
        {
          id: 106,
          section: "listening",
          type: "point",
          audio: "audio/test1/q106.mp3",
          audioSegments: [
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q106/01-narrator.mp3", text: "女の人と 男の人が 話して います。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q106/02-woman.mp3", text: "土曜日に 公園へ 行きませんか。", pauseAfter: 300 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q106/03-man.mp3", text: "土曜日は 雨ですよ。日曜日は 晴れです。", pauseAfter: 300 },
            { speaker: "woman", label: "女の人", audio: "audio/test1/q106/04-woman.mp3", text: "では、日曜日に 行きましょう。", pauseAfter: 350 },
            { speaker: "man", label: "男の人", audio: "audio/test1/q106/05-man.mp3", text: "はい。", pauseAfter: 450 },
            { speaker: "narrator", label: "ナレーター", audio: "audio/test1/q106/06-question.mp3", text: "二人は 何曜日に 公園へ 行きますか。", pauseAfter: 0 }
          ],
          script: "女の人と 男の人が 話して います。女の人：土曜日に 公園へ 行きませんか。男の人：土曜日は 雨ですよ。日曜日は 晴れです。女の人：では、日曜日に 行きましょう。二人は 何曜日に 公園へ 行きますか。",
          scriptTranslation: "A woman suggests going to the park on Saturday. The man says Saturday will be rainy and Sunday sunny, so they decide to go Sunday. Which day will they go?",
          question: "二人は 何曜日に 公園へ 行きますか。",
          options: ["金曜日", "土曜日", "日曜日", "月曜日"],
          answer: 2,
          explanation: "They decide to go on Sunday because Saturday will be rainy."
        },
        {
          id: 107,
          section: "listening",
          type: "utterance",
          audio: "audio/test1/q107.mp3",
          script: "バスで 聞いて ください。この バスは 駅へ 行きません。駅へ 行く 人は、つぎの バスに 乗って ください。駅へ 行く 人は どうしますか。",
          scriptTranslation: "An announcement says this bus does not go to the station. People going to the station should take the next bus. What should they do?",
          question: "駅へ 行く 人は どうしますか。",
          options: ["この バスに 乗ります", "つぎの バスに 乗ります", "電車に 乗ります", "歩いて 帰ります"],
          answer: 1,
          explanation: "The announcement says つぎのバスに乗ってください (please take the next bus)."
        },
        {
          id: 108,
          section: "listening",
          type: "utterance",
          audio: "audio/test1/q108.mp3",
          script: "れいぞうこの 中に、りんごが 二つと たまごが 三つ あります。バナナは ありません。正しい えは どれですか。",
          scriptTranslation: "There are two apples and three eggs in the refrigerator. There are no bananas. Which picture is correct?",
          question: "正しい えは どれですか。",
          options: [
            { text: "りんご 二つ、たまご 三つ", image: "🍎🍎  🥚🥚🥚" },
            { text: "りんご 三つ、たまご 二つ", image: "🍎🍎🍎  🥚🥚" },
            { text: "りんご 二つ、バナナ 三つ", image: "🍎🍎  🍌🍌🍌" },
            { text: "たまご 三つ、バナナ 一つ", image: "🥚🥚🥚  🍌" }
          ],
          answer: 0,
          explanation: "The speaker says there are two apples and three eggs, with no bananas."
        },
        {
          id: 109,
          section: "listening",
          type: "quick-response",
          audio: "audio/test1/q109.mp3",
          script: "男の人が 聞きます。すみません、今、何時ですか。何と 答えますか。",
          scriptTranslation: "A man asks, “Excuse me, what time is it now?” What is the best response?",
          question: "何と 答えますか。",
          options: ["三時半です", "火曜日です", "駅です", "三人です"],
          answer: 0,
          explanation: "三時半です (it is 3:30) directly answers a question asking the time."
        },
        {
          id: 110,
          section: "listening",
          type: "quick-response",
          audio: "audio/test1/q110.mp3",
          script: "女の人が 話します。あした、いっしょに 公園へ 行きませんか。何と 答えますか。",
          scriptTranslation: "A woman asks, “Would you like to go to the park together tomorrow?” What is the best response?",
          question: "何と 答えますか。",
          options: ["はい、行きましょう", "公園は 駅の となりです", "きのうは 月曜日でした", "毎朝 七時に 起きます"],
          answer: 0,
          explanation: "はい、行きましょう (yes, let's go) is a natural response to the invitation."
        }
      ]
    },
    {
      id: "n5-test-2",
      title: "JLPT N5 Mock Test 2",
      description: "A second balanced set covering kanji, comparisons, locations, and schedules.",
      duration: 30,
      questions: [
        {
          id: 1,
          section: "vocabulary",
          question: "「電車」の よみかたは どれですか。",
          options: ["でんしゃ", "てんしゃ", "でんじゃ", "てんじゃ"],
          answer: 0,
          explanation: "電車 is read でんしゃ and means “train.”"
        },
        {
          id: 2,
          section: "vocabulary",
          question: "「休み」の よみかたは どれですか。",
          options: ["やすみ", "よすみ", "やずみ", "やしみ"],
          answer: 0,
          explanation: "休み is read やすみ and means “rest,” “holiday,” or “day off.”"
        },
        {
          id: 3,
          section: "vocabulary",
          question: "からだに あるものは どれですか。",
          options: ["て", "つくえ", "くるま", "えき"],
          answer: 0,
          explanation: "て means “hand,” which is a part of the body."
        },
        {
          id: 4,
          section: "vocabulary",
          question: "「上」の よみかたは どれですか。",
          options: ["した", "なか", "うえ", "そと"],
          answer: 2,
          explanation: "上 is read うえ and means “above” or “on top.”"
        },
        {
          id: 5,
          section: "vocabulary",
          question: "「古い」の はんたいの ことばは どれですか。",
          options: ["わるい", "あたらしい", "たかい", "おそい"],
          answer: 1,
          explanation: "The opposite of 古い (old) is 新しい／あたらしい (new)."
        },
        {
          id: 6,
          section: "grammar",
          question: "ねこが いすの 下（　）います。",
          options: ["を", "に", "で", "へ"],
          answer: 1,
          explanation: "に marks the location where a person or animal exists with います."
        },
        {
          id: 7,
          section: "grammar",
          question: "朝ごはんを 食べて（　）、学校へ 行きます。",
          options: ["まで", "から", "より", "でも"],
          answer: 1,
          explanation: "～てから means “after doing”: after eating breakfast, I go to school."
        },
        {
          id: 8,
          section: "grammar",
          question: "この 本は あの 本（　）おもしろいです。",
          options: ["しか", "まで", "より", "など"],
          answer: 2,
          explanation: "より marks the item used for comparison: “more interesting than that book.”"
        },
        {
          id: 9,
          section: "grammar",
          question: "兄は テニスが（　）。",
          options: ["上手です", "上手なです", "上手にです", "上手でしたか"],
          answer: 0,
          explanation: "上手です is the correct polite predicate meaning “is good at.”"
        },
        {
          id: 10,
          section: "grammar",
          question: "雨が ふって います（　）、かさを 持って 行きます。",
          options: ["から", "まで", "より", "だけ"],
          answer: 0,
          explanation: "から gives a reason: because it is raining, I will take an umbrella."
        },
        {
          id: 11,
          section: "reading",
          question: "スーパー「あおぞら」\n月曜日から 土曜日：午前九時～午後八時\n日曜日：午前十時～午後六時\n\n日曜日は 何時に あきますか。",
          options: ["午前八時", "午前九時", "午前十時", "午後六時"],
          answer: 2,
          explanation: "The Sunday hours begin at 午前十時 (10 a.m.)."
        },
        {
          id: 12,
          section: "reading",
          question: "わたしの 家族は 四人です。父は いしゃで、母は 先生です。姉は 大学生です。わたしは 学生です。\n\nだれが 先生ですか。",
          options: ["父", "母", "姉", "わたし"],
          answer: 1,
          explanation: "The passage says 母は先生です."
        },
        {
          id: 13,
          section: "reading",
          question: "駅を 出て、右へ まっすぐ 行って ください。二つ目の かどを 左へ まがると、右に ゆうびんきょくが あります。ゆうびんきょくは 銀行の となりです。\n\nゆうびんきょくは どこですか。",
          options: ["駅の 中", "銀行の となり", "一つ目の かど", "学校の うしろ"],
          answer: 1,
          explanation: "The final sentence says the post office is next to the bank."
        },
        {
          id: 14,
          section: "reading",
          question: "すずきさんは 月曜日と 水曜日と 金曜日に プールで およぎます。火曜日と 木曜日は 日本語の クラスへ 行きます。\n\n木曜日に 何を しますか。",
          options: ["プールで およぎます", "日本語を 勉強します", "うちで 休みます", "買いものを します"],
          answer: 1,
          explanation: "On Tuesdays and Thursdays, Suzuki goes to Japanese class."
        },
        {
          id: 15,
          section: "reading",
          question: "今、京都に います。きのうは 公園へ 行きました。きょうは 友だちと 山へ 行きます。あした 東京へ 帰ります。\n\nきょう、何を しますか。",
          options: ["公園へ 行きます", "山へ 行きます", "東京へ 帰ります", "うちで 休みます"],
          answer: 1,
          explanation: "The passage says きょうは友だちと山へ行きます."
        }
      ]
    }
  ]
};
