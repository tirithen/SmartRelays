#define PROOVE_SIGNAL_REPEATS 2
#define MAX_INPUT_CHARACTERS 32

extern "C" {
  #include <ProoveSignal.h>
}

const char radioTransmitPin = 13;
char bytesRecieved = 0;
char input[MAX_INPUT_CHARACTERS];
ProoveSignal prooveSignal;

void printHelp() {
  Serial.println("SmartRelay - Listens to serial commands at 115200 baud rate.");
  Serial.println("The first character is the name of the command. Terminate command");
  Serial.println("with decimal 0 or new line. Up to 32 characters are supported.");
  Serial.println("");
  Serial.println("Avaliable commands:");
  Serial.println("");
  Serial.println("H = Show this help");
  Serial.println("ex. H");
  Serial.println("");
  Serial.println("P = Control Proove Wall outlet followed by 8 hexadecimal chacters");
  Serial.println("ex. P5A0E0160");
  Serial.println("");
}

void sendProoveSignal() {
  // Interpet the serial input
  // Ex. P5A0E0160
  //     012345678
  prooveSignal.bytes[0] = twoHexCharsToByte(input[7], input[8]);
  prooveSignal.bytes[1] = twoHexCharsToByte(input[5], input[6]);
  prooveSignal.bytes[2] = twoHexCharsToByte(input[3], input[4]);
  prooveSignal.bytes[3] = twoHexCharsToByte(input[1], input[2]);

  // Send the signal
  prooveSignalSendData(radioTransmitPin, prooveSignal.data);
}

byte hexCharToByte(char character)
{
  if (character >= '0' && character <= '9') {
    return (byte)(character - '0');
  }
  else if (character >= 'A' && character <= 'F') {
    return (byte)(character - 'A' + 10);
  }
  else if (character >= 'a' && character <= 'f') {
    return (byte)(character - 'a' + 10);
  }
  
  return 0;
}

byte twoHexCharsToByte(char mostSignificantCharacter, char leastSignificantCharacter)
{
  return hexCharToByte(leastSignificantCharacter) + (hexCharToByte(mostSignificantCharacter) << 4);
}

void resetInput() {
  char index = 0;
  for (index = 0; index < MAX_INPUT_CHARACTERS; index++) {
    input[index] = 0;
  }
}

void act() {
  Serial.print("Recieved command: ");
  Serial.println(input);
  
  if (input[0] == 'P' || input[0] == 'p') { // If proove signal
    sendProoveSignal();
  } else if (input[0] == 'H' || input[0] == 'h') { // If proove signal
    printHelp();
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(radioTransmitPin, OUTPUT);
  printHelp();
}

void loop() {
  while (Serial.available()) {
    char inputCharacter = (char)Serial.read();

    if (inputCharacter == 0 || inputCharacter == '\n' || inputCharacter == '\r') {
      act();
      resetInput();
      bytesRecieved = 0;
    } else {
      input[bytesRecieved] = inputCharacter;
      bytesRecieved++;
    }
  }
}
